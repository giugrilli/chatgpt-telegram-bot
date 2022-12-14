import { UNLOCK_THOUGHT_CONTROL } from './constants/command';
import { Markup, Telegraf } from 'telegraf';
import { env } from './utils/env';
import { create, memory, send } from './conversation';
import { editMessage } from './bot';
import { UNLOCK_THOUGHT_CONTROL_MESSAGE } from './constants/message';

const allowed_ids = env.ALLOWED_IDS.split(',')

// Create a new telegraf bot instance
const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN, {
  handlerTimeout: 3 * 60 * 1000,
});

// When a user starts a conversation with the bot
bot.start(async (ctx) => {
  console.log('start', ctx.from);
  const id = ctx.from?.id;

  if (!allowed_ids.includes(id.toString())){
    return ctx.reply('❌ Not Allowed ❌');
  }

  // Create a keyboard
  const keyboard = Markup.keyboard([
    [Markup.button.callback(UNLOCK_THOUGHT_CONTROL, UNLOCK_THOUGHT_CONTROL)],
  ]);

  try {
    // Create a conversation for the user
    await create(ctx.from.id);
  } catch (e) {
    return ctx.reply('❌ Please check ChatGPT token.');
  }

  // Reply to the user with a greeting and the keyboard
  return ctx.reply(`Hello ${ctx.from?.first_name}! Let's chat`, keyboard);
});

// When the bot receives a text message
bot.on('text', async (ctx) => {
  // Get the text of the message and the user's ID
  const text = ctx.message?.text.trim();
  const id = ctx.from?.id;

  console.log('message-from', ctx.from);
  console.log('message-content -> ', text);

  if (!allowed_ids.includes(id.toString())){
    await ctx.reply('❌ Not Allowed ❌')
    return 
  }
  
  const getRandomGif = await fetch(
    "http://api.giphy.com/v1/gifs/random?tag=thinking&api_key=Al5wJ2bX1FQPosMW1BCgTNlho1j37MB8"
  );  

  // Create a keyboard that removes the previous keyboard
  const removeKeyboard = Markup.removeKeyboard();

  switch (text) {
    case UNLOCK_THOUGHT_CONTROL:
      // Reply with the UNLOCK_THOUGHT_CONTROL_MESSAGE and remove the keyboard
      await ctx.reply(UNLOCK_THOUGHT_CONTROL_MESSAGE, removeKeyboard);
      break;

    default:
      // If the message is not any command, send it to chatGPT

      // Send a typing indicator to the user
      await ctx.sendChatAction('typing');
      try {

        const gif = await getRandomGif.json();
        const animationmessage = await ctx.sendAnimation(gif.data?.images?.original_mp4?.mp4)
        const message = await ctx.sendMessage('thinking...');

        // Send the message to chatGPT
        const response = await send(id, text, 
          // (contents) => 
          //   editMessage(
          //     ctx,
          //     message.chat.id,
          //     message.message_id,
          //     contents || 'typing...',
          //   ),
        );

        // delete the message and send a new one to notice the user
        await Promise.all([
          ctx.telegram.deleteMessage(message.chat.id, message.message_id),
          ctx.telegram.deleteMessage(animationmessage.chat.id, animationmessage.message_id),
          ctx.reply(response, removeKeyboard),
        ]);
      } catch (e: any) {
     
        if (e.message.includes('403 Forbidden')){
          memory.set(id.toString(), null);
        }
        
        await ctx.sendMessage(
          '❌Something went wrong. Details: ' + e.message,
          removeKeyboard,
        );
      }
  }
});

bot.catch(console.error);
// Start the bot
bot.launch().then(console.log).catch(console.error);

console.log('Bot started');
