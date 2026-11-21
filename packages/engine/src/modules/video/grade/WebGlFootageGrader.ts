import type { FootageGrade } from '@modules/video/grade/FootageGrade';
import type { FootageGradeMath } from '@modules/video/grade/FootageGradeMath';
import type { FootageGrader } from '@modules/video/grade/FootageGrader';

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = (a_position + 1.0) * 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform sampler2D u_picture;
uniform vec3 u_gain;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_vignette;
uniform float u_vignetteStart;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec4 picture = texture(u_picture, v_uv);
  vec3 rgb = picture.rgb * u_gain;
  rgb = (rgb - 0.5) * u_contrast + 0.5;
  float luma = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(luma), rgb, u_saturation);
  float distance = length((v_uv - 0.5) * 2.0) / 1.41421356;
  rgb *= 1.0 - u_vignette * smoothstep(u_vignetteStart, 1.0, distance);
  outColor = vec4(clamp(rgb, 0.0, 1.0), picture.a);
}`;

type GradedCanvas = OffscreenCanvas | HTMLCanvasElement;

/** What one WebGL2 context holds for grading, built once. */
interface GradingProgram {
  readonly canvas: OffscreenCanvas;
  readonly gl: WebGL2RenderingContext;
  readonly texture: WebGLTexture;
  readonly uniforms: Readonly<Record<'gain' | 'contrast' | 'saturation' | 'vignette' | 'vignetteStart', WebGLUniformLocation | null>>;
}

/**
 * {@link FootageGrader} on the GPU: the context's pixels go up as a
 * texture, a fragment shader applies {@link FootageGradeMath}'s terms
 * to each, and the result is drawn back over them. The WebGL2 context is
 * made on the first grade and kept; where one cannot be made, every
 * grade goes to `fallback` instead. A context the browser has lost (a
 * GPU reset, memory pressure) is let go: that grade goes to `fallback`,
 * and the next makes a context again.
 *
 * A canvas holding another origin's pixels cannot go up as a texture,
 * so it is graded by `fallback`, which never reads them back. A canvas
 * stays that way for the rest of its life, so it is remembered and
 * every later grade of it goes to `fallback` straight away.
 */
export class WebGlFootageGrader implements FootageGrader {
  private program: GradingProgram | null = null;
  private unavailable = false;
  private readonly tainted = new WeakSet<GradedCanvas>();

  constructor(
    private readonly math: FootageGradeMath,
    private readonly fallback: FootageGrader,
  ) {}

  grade(
    context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
    width: number,
    height: number,
    grade: FootageGrade,
  ): void {
    if (!(width > 0 && height > 0) || this.math.isNeutral(grade)) return;
    const program = this.tainted.has(context.canvas) ? null : this.liveProgramOrNull();
    if (program === null || !this.rendered(program, context.canvas, width, height, grade)) {
      this.fallback.grade(context, width, height, grade);
      return;
    }
    context.save();
    context.globalCompositeOperation = 'copy';
    context.drawImage(program.canvas, 0, 0, width, height, 0, 0, width, height);
    context.restore();
  }

  /** Whether `source` was graded onto the program's canvas; false where it holds another origin's pixels. */
  private rendered(
    program: GradingProgram,
    source: GradedCanvas,
    width: number,
    height: number,
    grade: FootageGrade,
  ): boolean {
    try {
      this.render(program, source, width, height, grade);
      return true;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'SecurityError')) throw error;
      this.tainted.add(source);
      return false;
    }
  }

  private render(
    program: GradingProgram,
    source: GradedCanvas,
    width: number,
    height: number,
    grade: FootageGrade,
  ): void {
    const { gl, canvas, uniforms } = program;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.bindTexture(gl.TEXTURE_2D, program.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const terms = this.math.termsOf(grade);
    gl.uniform3f(uniforms.gain, terms.gain[0], terms.gain[1], terms.gain[2]);
    gl.uniform1f(uniforms.contrast, terms.contrast);
    gl.uniform1f(uniforms.saturation, terms.saturation);
    gl.uniform1f(uniforms.vignette, terms.vignette);
    gl.uniform1f(uniforms.vignetteStart, terms.vignetteStart);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** The program, unless its context was lost, in which case it is let go so the next grade makes another. */
  private liveProgramOrNull(): GradingProgram | null {
    const program = this.programOrNull();
    if (program === null || !program.gl.isContextLost()) return program;
    this.program = null;
    return null;
  }

  private programOrNull(): GradingProgram | null {
    if (this.program !== null || this.unavailable) return this.program;
    this.program = this.build();
    this.unavailable = this.program === null;
    return this.program;
  }

  /** The context, its shaders and its full-frame quad; null where WebGL2 cannot be had. */
  private build(): GradingProgram | null {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const canvas = new OffscreenCanvas(1, 1);
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
    if (gl === null) return null;
    const shaderProgram = this.link(gl);
    const texture = gl.createTexture();
    if (shaderProgram === null || texture === null) return null;
    gl.useProgram(shaderProgram);
    this.bindQuad(gl, shaderProgram);
    // A canvas's rows run top to bottom, a texture's bottom to top.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return {
      canvas,
      gl,
      texture,
      uniforms: {
        gain: gl.getUniformLocation(shaderProgram, 'u_gain'),
        contrast: gl.getUniformLocation(shaderProgram, 'u_contrast'),
        saturation: gl.getUniformLocation(shaderProgram, 'u_saturation'),
        vignette: gl.getUniformLocation(shaderProgram, 'u_vignette'),
        vignetteStart: gl.getUniformLocation(shaderProgram, 'u_vignetteStart'),
      },
    };
  }

  private link(gl: WebGL2RenderingContext): WebGLProgram | null {
    const vertex = this.compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = this.compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (vertex === null || fragment === null || program === null) return null;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
  }

  private compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (shader === null) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  }

  private bindQuad(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }
}
