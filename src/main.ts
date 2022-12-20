import { UNLOCK_THOUGHT_CONTROL } from './constants/command';
import { Markup, Telegraf } from 'telegraf';
import { env } from './utils/env';
import { create, resetLogin, send, isLogged, resetThread } from './conversation';
import { editMessage } from './bot';
import { UNLOCK_THOUGHT_CONTROL_MESSAGE } from './constants/message';
import fs from 'fs'
import sdk from 'microsoft-cognitiveservices-speech-sdk'
import axios from 'axios'
import stream from 'stream';
import util from 'util'
import ffmpeg from 'fluent-ffmpeg'

const pipeline = util.promisify(stream.pipeline);
const allowed_ids = env.ALLOWED_IDS.split(',')

// Create a new telegraf bot instance
const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN, {
  handlerTimeout: 3 * 60 * 1000,
});

// When a user starts a conversation with the bot
bot.start(async (ctx) => {
  console.log('start', ctx.from);
  const id = ctx.from?.id;

  if (!allowed_ids.includes(id.toString())) {
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

const checkPreviousContext = (message: any) => {
  const previousMessage = message.reply_to_message?.text
  let contextArray = []
  if (previousMessage) {
    const regex = /\{GPTContext:\[.*\]\}/
    const hasPreviousContext = regex.test(previousMessage)
    if (hasPreviousContext) {
      contextArray = previousMessage.substring(
        previousMessage.indexOf("[") + 1,
        previousMessage.lastIndexOf("]")
      ).split(',')
    }
  }
  return contextArray
}

// This example requires environment variables named "SPEECH_KEY" and "SPEECH_REGION"



const convertVoiceToText = async (ctx: any) => {

  const message = await ctx.sendMessage('Converting...');

  const speechConfig = sdk.SpeechConfig.fromSubscription(env.AZURE_SPEECH_KEY, env.AZURE_SPEECH_REGION)
  const sourceConfig = sdk.AutoDetectSourceLanguageConfig.fromLanguages(['en-US', 'it-IT', 'fr-FR'])

  const audioUrl = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
  console.log("AUDIOURL", audioUrl)

  const response = await axios({
    method: 'GET',
    url: audioUrl.href,
    responseType: 'stream'
  });

  const filename = Buffer.from(Math.random().toString()).toString("base64").substring(10, 15);
  await pipeline(response.data, fs.createWriteStream(`tmp/${filename}.oga`));

  await new Promise((resolve, reject) => {
    ffmpeg(`tmp/${filename}.oga`)
      .output(`tmp/${filename}.wav`)
      .on('end', () => resolve(1))
      .run();
  })
  const wavFile = fs.readFileSync(`tmp/${filename}.wav`);
  const audioConfig = sdk.AudioConfig.fromWavFileInput(wavFile);
  const speechRecognizer = sdk.SpeechRecognizer.FromConfig(speechConfig, sourceConfig, audioConfig)
  const arrayText: string[] = []
  let oldArrayTextLength = 0
  let recognitionChecker: string | number | NodeJS.Timeout | undefined
  let finalText = ''
  await new Promise((resolve, reject) => {
    speechRecognizer.startContinuousRecognitionAsync()
    speechRecognizer.recognized = (reco, e) => {
      try {
        const res = e.result;
        console.log(`recognized: ${res.text}`);
        arrayText.push(res.text)
        clearInterval(recognitionChecker)
        recognitionChecker = setInterval(()=>{
          if (arrayText.length == oldArrayTextLength){
            speechRecognizer.stopContinuousRecognitionAsync()
            resolve(res.text)
          } else {
            oldArrayTextLength = arrayText.length
          }
        }, 4000)
      } catch (error) {
        console.log(error);
        reject()
      }
    };
  })

  finalText = arrayText.join(' ')

  fs.unlink(`tmp/${filename}.oga`, function (err) {
    if (err) {
      console.error(err);
      console.log('File not found');
    } else {
      console.log('File Delete Successfuly');
    }
  });
  fs.unlink(`tmp/${filename}.wav`, function (err) {
    if (err) {
      console.error(err);
      console.log('File not found');
    } else {
      console.log('File Delete Successfuly');
    }
  });

  try{
    ctx.telegram.deleteMessage(message.chat.id, message.message_id)
  } catch {}

  finalText = finalText.replace(/\W+/g, " ")

  return String(finalText)
}

const doAllTheHandling = (ctx: any) => {
  return new Promise(async (resolve, reject) => {

    const id = ctx.from?.id;

    if (!allowed_ids.includes(id.toString())) {
      await ctx.reply('❌ Not Allowed ❌')
      return
    }
  
    let text = ''
  
    // @ts-ignore
    if (ctx.message.text) {
      // @ts-ignore
      text = ctx.message?.text.trim();
    
      // @ts-ignore
    } else if (ctx.message.voice) {
      text = await convertVoiceToText(ctx)
      ctx.sendMessage(`Converted: ${text}`);
    } else {
      return
    }
  
    if (!text || text === '') {
      return
    }
  
    if (text.toLowerCase() === 'reset'){
      resetThread(id.toString())
      ctx.sendMessage(`Thread Reset.`);
      return
    }

    let contextArray = checkPreviousContext(ctx.message)
  
    const getRandomGif = await fetch(
      `http://api.giphy.com/v1/gifs/random?tag=thinking&api_key=${env.GIPHY}`
    );
  
    const removeMessages = async (message: any, animationmessage: any, loginMessage: any) => {
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
          const finalResponse = response.response + `\n\n {GPTContext:[${response.conversationId},${response.messageId}]}`
          await ctx.reply(finalResponse, { remove_keyboard: true, reply_to_message_id: ctx.message.message_id })
        } catch (e: any) {
          await removeMessages(message, animationmessage, loginMessage)
          await ctx.sendMessage('❌ Something went wrong. Details: ' + e.message, removeKeyboard)
          if (
            // e.message.includes('error 403') || 
            e.message.includes('error 429') || 
            e.message.includes('error 503') || 
            e.message.includes('error 524')){
            resetLogin(id.toString())
            await ctx.sendMessage(
              '❗️ Just try again now ❗️'
            );
      }
        }
    }
    resolve(true)

  });
}

// When the bot receives a text message
bot.on('message', async (ctx) => {
  doAllTheHandling(ctx)
});

bot.catch(console.error);
// Start the bot
bot.launch().then(console.log).catch(console.error);

console.log('Bot started');
