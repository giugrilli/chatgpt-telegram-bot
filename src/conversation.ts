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
  context: string
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
    response = await api.browser.sendMessage(context, { conversationId: api.latestResponse?.conversationId, parentMessageId: api.latestResponse?.messageId } )
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

/**
 * create a new conversation
 */
export const create = async (id: number | string) => {
  const sId = id.toString();
  const api = new ChatGPTAPIBrowser({
      email: env.OPENAI_EMAIL,
      password: env.OPENAI_PASSWORD,
      isGoogleLogin: true,
    })
  await api.initSession()
  memory.set(sId, {browser: api, latestResponse: undefined});
};
