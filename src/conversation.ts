import { ChatGPTAPI, ChatGPTConversation, getOpenAIAuth } from 'chatgpt';
import { env } from './utils/env';

// store conversation
const memory = new Map<string, ChatGPTConversation|null>();

let api:any

const authInfo = () => {
    return getOpenAIAuth({
    email: env.OPENAI_EMAIL,
    password: env.OPENAI_PASSWORD,
    isGoogleLogin: true
  })
}

/**
 * send message to chatGPT
 */
export const send = async (
  id: number | string,
  context: string,
  onResponse?: (contents: string) => void,
) => {
  const sId = id.toString();
  let conversation = memory.get(sId);

  if (!conversation) {
    conversation = await create(sId);
  }

  return conversation.sendMessage(context, {
    timeoutMs: 2 * 60 * 1000,
    onConversationResponse(even) {
      onResponse?.(even.message?.content.parts[0] || '');
    },
  });
};

export const resetLogin = async (id:string) => {
  memory.set(id, null);
}

/**
 * create a new conversation
 */
export const create = async (id: number | string) => {
  const sId = id.toString();
  const authInfoData = await authInfo();
  const api = new ChatGPTAPI({ ...authInfoData })
  await api.ensureAuth();
  const conversation = api.getConversation();
  memory.set(sId, conversation);
  return conversation;
};
