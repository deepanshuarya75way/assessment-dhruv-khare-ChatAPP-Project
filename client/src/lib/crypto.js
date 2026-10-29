const KEY_STORAGE="chat-keys-";
const ENC_PREFIX="enc:v1:";
const ecdhParams={name:"ECDH", namedCurve:"P-256"};

const bufferToBase64=(buffer)=> btoa(String.fromCharCode(...new Uint8Array(buffer)));

const base64toBuffer=(text)=>Uint8Array.from(atob(text),(char)=>char.charCodeAt(0));

const createKeys= async (userId)=>{
  const saved=localStorage.getItem(KEY_STORAGE+userId);
  if(saved)
  {
    try{
      return JSON.parse(saved);
    }
    catch(error){
      console.log("create new keys");
    }
  }

  const pair=await crypto.subtle.generateKey(ecdhParams,true,["deriveKey"]);
  const privateKey=await crypto.subtle.exportKey("jwk",pair.privateKey);
  const exportedPublic=await crypto.subtle.exportKey("jwk",pair.publicKey);
  const keys={privateKey,publicKey:JSON.stringify(exportedPublic)};

  localStorage.setItem(KEY_STORAGE+userId,JSON.stringify(keys));
  return keys;
}

const keyRequests=new Map();
const getMyKeys=(userId)=>{
  if(!keyRequests.has(userId)) keyRequests.set(userId,createKeys(userId));
  return keyRequests.get(userId);
}

//both user get the same key 
const getSharedKey=async (myPrivateKey,otherPublicKey)=>{
  const privateKey=await crypto.subtle.importKey("jwk",myPrivateKey,ecdhParams,false,["deriveKey"]);
  const publicKey=await crypto.subtle.importKey("jwk",JSON.parse(otherPublicKey),ecdhParams,false,[]);


  return crypto.subtle.deriveKey({name:"ECDH",public:publicKey},
    privateKey,
    {name:"AES-GCM",length:256},
    false,
    ["encrypt","decrypt"],
  );
};


const isEncryptedMessage=(text)=> typeof text==="string" && text.startsWith(ENC_PREFIX);

const encrypMesssage=async (sharedKey,text)=>{
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},
    sharedKey,
    new TextEncoder().encode(text),
  );

  return `${ENC_PREFIX}${bufferToBase64(iv)}:${bufferToBase64(encrypted)}`;
}


const decryptMessage= async (sharedKey,text)=>{
  try{
    const [iv,data]=text.slice(ENC_PREFIX.length).split(":");
    const decrypted=await crypto.subtle.decrypt({name:"AES-GCM",iv:base64toBuffer(iv)}, sharedKey,base64toBuffer(data),);

    return new TextDecoder().decode(decrypted);
  } catch(error){
    return null;
  }
};

export {
  getMyKeys,
  getSharedKey,
  isEncryptedMessage,
  encrypMesssage,
  decryptMessage,
}

