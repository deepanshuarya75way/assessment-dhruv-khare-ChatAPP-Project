const encoder=new TextEnoder();
const decoder=new TextDecoder();

export async fundtion generateMsgKey(){
  return window.crypto.subtle.generateKey({
    name:"AES-GCM",
    length:256,
  },
  true,
  ["encrypt","decrypt"]
);
}


export async function encryptMsg(message,key){

  const iv=window.crypto.getRandomValues(new Unit8Array(12));
  const encrypted=await window.crypto.subtle.encrypt({
    name:"AES-GCM",
    iv,
  },
key,
encoder.encode(message));

return {
  ciphertext:arrayBufferToBase64(encrypted),
  iv:arrayBufferToBase64(iv),
  algorithm:"AES-GCM",
};
}

