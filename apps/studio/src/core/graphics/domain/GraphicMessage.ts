/** Something a graphic's code said while it ran: a line it logged, or an error it threw. */
export interface GraphicMessage {
  readonly level: 'log' | 'warn' | 'error';
  readonly text: string;
}
