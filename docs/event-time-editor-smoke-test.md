# Event-time editor real-vault smoke test

Use a disposable copy of a real vault with Writing Companion open in the right sidebar. Keep the developer console available and note the editorial-store files before starting.

1. Open the Story World navigator, select **Robin is Born**, and confirm its authoritative Markdown remains open in the centre editor. In the entity inspector choose **Edit event time**, select **Day**, enter an exact date, check the British-English preview, confirm, and verify only `world_time` changed.
2. Edit the event again, switch from **Point** to **Range**, enter distinct start and end dates, confirm, and check the inspector labels the value as a range. Switch back to point and confirm the preview and saved mapping use `at` rather than range endpoints.
3. Select **Minute**, enter a date, time, and an explicit offset such as `+01:00`. Save and confirm the written offset is unchanged and the displayed wall-clock time has not moved through the computer timezone.
4. Begin another edit, alter controls, then choose **Cancel**. Confirm no Markdown changes were written and the event relationship list and inspector remain visible.
5. Temporarily give an event an unsupported qualified value, for example an `observed-window` precision with a `source` field. Open the editor and confirm the preserved structured-time message appears without raw YAML and the note remains byte-for-byte unchanged until **Replace with supported exact time** is explicitly chosen.
6. Choose **Set as undated**, decline the confirmation once, then accept it. Confirm declining writes nothing and accepting removes only `world_time`.
7. With a chapter whose story date is near Robin is Born, open World Context before and after changing the event date. Confirm its existing relative interval updates to the new authoritative date.
8. Review the event note diff and editorial-store files. Confirm manuscript prose, unrelated frontmatter, and editorial storage are unchanged throughout.
