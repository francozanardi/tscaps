---
title: Shots, b-roll, pictures, camera moves, following a person and transitions
keywords: shot, shots, scene, b-roll, broll, cutaway, overlay video, picture, image, photo, gif, sticker, media, upload file, several shots, across shots, longer, whole video, shows through, continues, how long a layer shows, picture in picture, pip, split screen, full screen, layout, zoom, pan, camera, ken burns, punch in, reframe, reframing, framing, follow the speaker, follow a person, track a person, keep the person in frame, moving person, crop to vertical, transition, whip, fade, flash, split shot, join shots
labels: Video, Shots, Media, Max length, Shot options, Add, Join with previous shot, Join with next shot, Edit timing, Cut, Start a new shot at this word, B-roll, Picture or GIF, Camera move, Transition, Upload a video, Upload a picture or GIF, Add to current shot, Layout, Motion, Full screen, Split screen, Picture in picture, Replace, Remove, Duration, Whole video, Recalculate shots, None, Duration, Follow, Following, Look for people again, Zoom
covers: src/ui/pages/editor/features/shots, src/ui/pages/editor/features/media, src/core/shots
---
In the **Video** mode, the **Shots** tab lists the video cut into shots, one card each. A shot is where you decide what the picture shows: b-roll, pictures, GIFs and graphics on top of your video, a camera move, and the transition into it.

## Split and join shots
Shots are proposed for you once the video is transcribed. **Max length** sets how long they get (changing it, or **Recalculate shots** in the shots menu, throws away your shot edits, so it asks first).
- To split: click a word in a shot card's text and choose **Start a new shot at this word**.
- To join: right-click a card (or click **Shot options**) and choose **Join with previous shot** or **Join with next shot**.
- To move an edge: **Edit timing** in the same menu.

## Add b-roll, a picture or a GIF
1. Click **Add** at the bottom of a shot card.
2. Choose **B-roll** for a video, or **Picture or GIF**. **B-roll** is offered while the shot has none; to change the one it has, click its pill and choose **Replace**.
3. Pick a file you already added, or **Upload a video** / **Upload a picture or GIF**.

You can also drag a file from the **Media** tab onto a shot card, or use its **Add to current shot**. A b-roll's menu offers **Replace** and **Remove**; the file stays in **Media**.

## Keep a layer on screen over several shots
A b-roll, picture, GIF or graphic shows for the shot you added it to. To keep it on screen over the shots that follow, as one layer that enters once and leaves once:
1. Click the layer's pill on its shot card.
2. Click **Duration**, which says which shots it shows on (*Shot 2*, *Shots 2–4*). The list gives each stretch it can cover from its own shot, with how many seconds that lasts; a line on top shows where that stretch falls in the video. Pick one. The first one, its own shot alone, takes it back to that shot.

Each later shot it shows on carries the same pill, quieter and marked with an arrow; clicking it opens the same menu. Splitting a shot does not shorten a layer that shows on it: the layer goes on over both halves, and **Duration** ends it where you want. To keep something for the whole video, pick **Whole video** at the top of that list: it then sits in a **Whole video** card above the shots instead of on every card, and its pill there opens the same menu.

## Place a layer: full screen, picture in picture, split screen
Click the layer's pill on the shot card, then **Edit**. On the **Layout** tab pick **Full screen**, **Split screen** or **Picture in picture**, then set its box (position, size, shape). With a box picked on the preview, drag it to move it and drag a corner to resize it. The **Motion** tab sets how it enters and leaves.

## Add a camera move
Click **Add** on a shot card and choose **Camera move**. Pick a move (zoom, pan, punch in and others) or **None**, then set where it zooms on the preview.

The camera then shows as a pill on the card. Click it for **Edit**, **Remove**, and **Duration**, which runs the same move over the shots that follow: pick the last shot it should run over. Those shots carry the camera's pill too, marked with an arrow. Splitting a shot keeps its camera running over both halves as one move; **Duration**, then the first row, the shot alone, ends it at the split. A shot that gets a camera of its own stops the one running into it.

To move where a shot looks afterwards, open the shot's **Camera** tab and drag the box under **Position**.

## Follow a person
When the frame crops the video (a vertical shape for a wide video, picked in **Ratio**), the camera of a shot can follow a person who moves. Click **Add** on the shot card and choose **Camera move**, then pick **Follow** among the cameras.
- The editor looks for people in the shot. If it finds one person, the camera follows that person.
- If it finds several people, it shows them on a frame of the shot. Click the person to follow.
- It then follows the person through the whole shot and moves the camera to keep them in the frame. On a long shot or a slow device, this can take a while. To stop it, pick **None** or another camera.

The section then shows a frame of the shot, the one under the playhead, with a box marked **Following** around what the camera shows on it. Move the playhead to see the camera on another frame. **Zoom** sets how close the camera holds the person, and the box follows it. On the frame the person was picked on, the others found there have a dashed box: to follow someone else, click their box. To look at the shot again, click **Look for people again**; it looks at the frame shown first. To stop following, pick **None** or another camera. If no person is found in the shot, the camera stays as it was.

## Add a transition between shots
Between two shot cards there is a thin line: hover it and click **Transition**. Pick one (such as Flash, Whip or Dip to black) and set its **Duration**. Pick **None** to go back to a plain cut.
