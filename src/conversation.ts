import { ChatGPTAPI, ChatGPTAPIBrowser, ChatResponse, getOpenAIAuth } from 'chatgpt';
import { env } from './utils/env';

// store conversation
type chatGPTSession = {browser?: ChatGPTAPIBrowser, latestResponse?: ChatResponse }
const memory = new Map<string, chatGPTSession|undefined>();

let api:any

/**
 * send message to chatGPT
 */
export const send = async (
  id: number | string,
  message: string,
  context: Array<string>
):Promise<ChatResponse> => {
  let response:ChatResponse = {
    response: '',
    conversationId: '',
    messageId: ''
  } 
  const sId = id.toString();
  let api = memory.get(sId);
  if (!api) {
    await create(sId);
    api = memory.get(sId);
  }
  if (api?.browser){

    let conversationId = api.latestResponse?.conversationId
    let parentMessageId = api.latestResponse?.messageId

    if((context.length != 0) ){
      conversationId = context[0]
      parentMessageId = context[1]
    }

    response = await api.browser.sendMessage(message, { conversationId: conversationId, parentMessageId: parentMessageId} )
    memory.set(sId, {browser: api?.browser, latestResponse: response})
  }
  return response
};

export const resetLogin = async (id:string) => {
  const api = memory.get(id);
  if (api?.browser){
    await api?.browser.closeSession()
  }
  memory.set(id, undefined);
}

export const isLogged = async (id:string) => {
  let api = memory.get(id)
  return !!api
}

export const resetThread = async(id:string) => {
  let api = memory.get(id)
  await api?.browser?.resetThread()
  memory.set(id, {browser: api?.browser, latestResponse: undefined});
  return true
}
/**
 * create a new conversation
 */
export const create = async (id: number | string) => {
  const sId = id.toString();
  const all_credentials = JSON.parse(env.OPENAI_CREDENTIALS)
  const current_credentials = all_credentials[Math.floor(Math.random()*all_credentials.length)];
  const api = new ChatGPTAPIBrowser({
      email: current_credentials[0],
      password: current_credentials[1],
      isGoogleLogin: true,
    })
  await api.initSession()
  memory.set(sId, {browser: api, latestResponse: undefined});
};
