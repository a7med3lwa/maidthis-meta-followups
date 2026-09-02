insert into followup_templates (stage, label, body, match_phrase, media_file) values
  (1, 'Pets question', 'Hi {{first_name}}, just curious - do you have any pets in the home?', 'just curious do you have any pets in the home', null),
  (2, 'Cleaning check-in', 'Hi {{first_name}}, checking in 😊 Would you still like to get your home cleaning scheduled?', 'would you still like to get your home cleaning scheduled', null),
  (3, 'Skeleton meme', 'Lol, waiting for {{first_name}} like…', 'lol waiting for', 'skeleton.jpg'),
  (4, 'Hold or release', 'Hi {{first_name}}, haven’t heard back yet. Would you like me to hold a spot for you, or should I release it to the next homeowner?', 'would you like me to hold a spot for you or should i release it', null),
  (5, 'Offer available times', 'Hi {{first_name}}, we’d be happy to take care of your cleaning whenever you’re ready. Want me to send over some available times?', 'want me to send over some available times', null),
  (6, 'Good time to chat', 'Hi {{first_name}}, is now a good time to chat about your cleaning?', 'is now a good time to chat about your cleaning', null),
  (7, 'Name ping', '{{first_name}}?', '__name_ping__', null),
  (8, 'Delivery check', 'Are my messages going through okay?', 'are my messages going through okay', null),
  (9, 'Mr. Bean', 'Now you got me feeling like Mr. Bean ..😂', 'now you got me feeling like mr bean', 'mr-bean.png'),
  (10, 'Final opt-out', 'If you’re no longer interested, no worries at all - just let me know so I don’t bug you 😊', 'if youre no longer interested no worries at all', null)
on conflict (stage) do update set
  label = excluded.label,
  body = excluded.body,
  match_phrase = excluded.match_phrase,
  media_file = excluded.media_file,
  updated_at = now();
