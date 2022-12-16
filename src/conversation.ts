import { ChatGPTAPI, ChatGPTAPIBrowser, ChatGPTConversation, getOpenAIAuth } from 'chatgpt';
import { env } from './utils/env';

// store conversation
const memory = new Map<string, ChatGPTAPIBrowser|null>();

let api:any

/**
 * send message to chatGPT
 */
export const send = async (
  id: number | string,
  context: string
) => {
  const sId = id.toString();
  let api = memory.get(sId);
  if (!api) {
    api = await create(sId);
  }
 const response = await api.sendMessage(context)
 return response
};

export const resetLogin = async (id:string) => {
  const api = memory.get(id);
  await api?.close()
  memory.set(id, null);
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
  await api.init()
  memory.set(sId, api);
  return api;
};
