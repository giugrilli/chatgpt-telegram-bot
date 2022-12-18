import { UNLOCK_THOUGHT_CONTROL } from './constants/command';
import { Markup, Telegraf } from 'telegraf';
import { env } from './utils/env';
import { create, resetLogin, send, isLogged } from './conversation';
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

const checkPreviousContext = (message:any) => {
  const previousMessage = message.reply_to_message?.text
  let contextArray = []
  if (previousMessage){
    // @ts-ignore
    const regex = /\{GPTContext:\[.*\]\}/
    // @ts-ignore
    const hasPreviousContext = regex.test(previousMessage)
    if(hasPreviousContext){
      contextArray = previousMessage.substring(
        previousMessage.indexOf("[") + 1, 
        previousMessage.lastIndexOf("]")
      ).split(',')
    }
  }
  return contextArray
}

// When the bot receives a text message
bot.on('text', async (ctx) => {
  // Get the text of the message and the user's ID
  const text = ctx.message?.text.trim();
  const id = ctx.from?.id;

  if (!allowed_ids.includes(id.toString())){
    await ctx.reply('❌ Not Allowed ❌')
    return 
  }
  let contextArray = checkPreviousContext(ctx.message)

  const getRandomGif = await fetch(
    "http://api.giphy.com/v1/gifs/random?tag=thinking&api_key=Al5wJ2bX1FQPosMW1BCgTNlho1j37MB8"
  );  

  const removeMessages = async (message:any, animationmessage:any, loginMessage:any) => {
    await Promise.all([
      message && ctx.telegram.deleteMessage(message.chat.id, message.message_id),
      animationmessage && ctx.telegram.deleteMessage(animationmessage.chat.id, animationmessage.message_id),
      loginMessage && ctx.telegram.deleteMessage(loginMessage.chat.id, loginMessage.message_id)
    ]);
  }

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
      let message
      let animationmessage
      let loginMessage
      try {

        const gif = await getRandomGif.json();
        animationmessage = await ctx.sendAnimation(gif.data?.images?.original_mp4?.mp4)
        message = await ctx.sendMessage('Thinking...');

        const isGptLogged = await isLogged(id.toString())
        if (!isGptLogged) {
          loginMessage = await ctx.sendMessage('Login in progress... This will take time...');
        }
        // Send the message to chatGPT
        const response = await send(id, text, contextArray);
        const messages = {
          sender: ctx.from,
          query: text, 
          response: response
        }
        console.log('messages', messages);
        // delete the message and send a new one to notice the user
        await removeMessages(message, animationmessage, loginMessage)
        const finalResponse = response.response+`\n\n {GPTContext:[${response.conversationId},${response.messageId}]}`
        await ctx.reply(finalResponse, removeKeyboard)
      } catch (e: any) { 
        await removeMessages(message, animationmessage, loginMessage)
        await ctx.sendMessage('❌ Something went wrong. Details: ' + e.message, removeKeyboard)
        await ctx.sendMessage('❗️ Just try again now ❗️');
      }
  }
});

bot.catch(console.error);
// Start the bot
bot.launch().then(console.log).catch(console.error);

console.log('Bot started');
