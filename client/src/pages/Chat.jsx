// import React from "react";
import { Box, IconButton, Skeleton, Stack, Typography } from "@mui/material";
import Applayout from "../componenets/layout/Applayout.jsx";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
  AttachFile as AttachFileIcon,
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  Lock as LockIcon,
  Send as SendIcon,
} from "@mui/icons-material";
import { InputBox } from "../componenets/styled/StyledComponent.jsx";
import FileMenu from "../componenets/Dialog/FileMenu.jsx";
// import { sampleMessage } from "../contants/sampleData.js";
import MessageComponent from "../componenets/shared/MessageComponent.jsx";
import { useSocket } from "../socketContext.js";
import {
  ALERT,
  CHAT_JOINED,
  CHAT_LEAVED,
  NEW_MESSAGE,
  START_TYPING,
  STOP_TYPING,
} from "../contants/event.js";
import {
  useGetChatDetailsQuery,
  useGetMyMessagesQuery,
} from "../redux/api/api.js";
import { useErrors, useSocketEvents } from "../hooks/hook.jsx";
import { useInfiniteScrollTop } from "6pp";
import { useDispatch } from "react-redux";
import { setIsFileMenu } from "../redux/reducer/msc.js";
import { removeNewMessageAlert } from "../redux/reducer/chat.js";
import { TypingLoader } from "../componenets/layout/Loaders.jsx";
import { useNavigate } from "react-router-dom";
import AvatarCard from "../componenets/shared/AvatarCard.jsx";

import toast from "react-hot-toast";
import { useGetPublicKeyQuery } from "../redux/api/api.js";

import { decryptMessage,encrypMesssage,getMyKeys,getSharedKey,isEncryptedMessage } from "../lib/crypto.js";

const Chat = ({ chatId, user, selectedChat }) => {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);

  const socket = useSocket();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // console.log(chatId===user._id,chatId,user._id);
  // const fileMenuRef = useRef(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [page, setPage] = useState(1);
  const [fileMenuAnchor, setFileMenuAnchor] = useState(null);

  const [sharedKey,setSharedKey]=useState(null);
  const [decryptedText,setDecryptedText]=useState({});

  const [iAmTyping, setIAmTyping] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const typingTimeOut = useRef(null);

  const chatDetails = useGetChatDetailsQuery({ chatId, skip: !chatId });
  const oldMessagesChunk = useGetMyMessagesQuery({ chatId, page });

  const totalPage = oldMessagesChunk?.data?.totalPages;
  const newData = oldMessagesChunk?.data?.messages;

  const { data: oldMessages, setData: setOldMessages } = useInfiniteScrollTop(
    containerRef,
    totalPage,
    page,
    setPage,
    newData,
  );

  const errors = [
    { isError: chatDetails.isError, error: chatDetails.error },
    { isError: oldMessagesChunk.isError, error: oldMessagesChunk.error },
  ];
  // console.log(chatDetails.data);

  // console.log("oldMessageChunk", oldMessagesChunk.data);
  const members = chatDetails?.data?.chat?.members;


  const isDirectChat=!!chatDetails?.data?.chat && !chatDetails.data.chat.groupChat;
  const otherUserId=isDirectChat ? members.find((id)=>id.toString()!== user._id.toString()):null;
  const otherUserKey=useGetPublicKeyQuery(otherUserId,{skip:!otherUserId,});
  const otherPublicKey=otherUserKey.data?.publicKey;

  const attatchFileMEnuHanlder = (e) => {
    dispatch(setIsFileMenu(true));
    setFileMenuAnchor(e.currentTarget);
  };

  const messageOnChangeHandler = (e) => {
    setMessage(e.target.value);

    if (!iAmTyping) {
      socket.emit(START_TYPING, { members, chatId });
      setIAmTyping(true);
    }

    if (typingTimeOut.current) clearTimeout(typingTimeOut.current);

    typingTimeOut.current = setTimeout(() => {
      setIAmTyping(false);
      socket.emit(STOP_TYPING, { members, chatId });
    }, [2000]);
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    // console.log(message);
    if (!message.trim()) return;

    let messageToSend=message;
    if(isDirectChat){
      if(!sharedKey){
        toast.error("Seacure key is not ready");
        return ;
      }
      messageToSend=await encrypMesssage(sharedKey,message);
    }
    socket.emit(NEW_MESSAGE, { chatId, message:messageToSend, members });
    setMessage("");
  };

  useEffect(()=>{
    let isCancelled=false;
    setSharedKey(null);
    setDecryptedText({});

    if(!isDirectChat || !otherPublicKey || !user._id) return ;

    const makeSharedKey = async ()=>{

      try{
        const myKeys=await  getMyKeys(user._id);
        const key=await getSharedKey(meyKeys.privateKey,otherPublicKey);
        if(!isCancelled){
          setSharedKey(key);
        }
      } catch(error){
        console.log("error in creating shared key:", error);
      }
    };
    makeSharedKey();

    return ()=>{
      isCancelled=true;
    };
  },[isDirectChat,otherPublicKey,user?._id]);

  useEffect(() => {
    dispatch(removeNewMessageAlert(chatId));
    socket.emit(CHAT_JOINED, { userId:user._id , members });
    return () => {
      setMessage("");
      setMessages([]);
      setOldMessages([]);
      setPage(1);
          socket.emit(CHAT_LEAVED, { userId:user._id , members });

    };
  }, [chatId, dispatch, members, setOldMessages, socket, user._id]);

  useEffect(() => {
    if (bottomRef.current)
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [message]);

  useEffect(() => {
    if (chatDetails.isError) return navigate("/");
  }, [chatDetails.isError, navigate]);

  const newMessagesHandler = useCallback(
    (data) => {
      // console.log(data);
      if (data.chatId !== chatId) return;
      setMessages((prev) => [...prev, data.message]);
    },
    [chatId],
  );
  const startTypingListener = useCallback(
    (data) => {
      if (data.chatId !== chatId) return;
      // console.log("start - typing",data);
      setUserTyping(true);
    },
    [chatId],
  );
  const stopTypingListener = useCallback(
    (data) => {
      if (data.chatId !== chatId) return;
      // console.log("stop - typing",data);
      setUserTyping(false);
    },
    [chatId],
  );
  const newAlertListener = useCallback(
    (data) => {
      if (data.chatId !== chatId) return;
      const messageForAlert = {
        content: data.message,
        sender: {
          _id: "jshjahifoioeiofoiu",
          name: "Admin",
        },
        chat: chatId,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, messageForAlert]);
    },
    [chatId],
  );

  const eventArr = {
    [ALERT]: newAlertListener,
    [NEW_MESSAGE]: newMessagesHandler,
    [START_TYPING]: startTypingListener,
    [STOP_TYPING]: stopTypingListener,
  };

  useSocketEvents(socket, eventArr);

  useErrors(errors);

  const allMessages = [...oldMessages, ...messages];
  const conversationTitle = selectedChat?.groupChat
    ? chatDetails?.data?.chat?.name
    : selectedChat?.name || chatDetails?.data?.chat?.name || "Conversation";
  // console.log(allMessages);

  useEffect(()=>{
    if(!sharedKey) return ;

    const notDecrypted=allMessages.filter(
      (m)=>isEncryptedMessage(m.content) && decryptedText[m._id]===undefined,
    );
    if(notDecrypted.length===0) return ;

    let isCancelled=false;
    const decryptAll= async ()=>{
      const result ={};
      for(const m of notDecrypted)
      {
        result[m._id]=await decryptMessage(sharedKey,m.content);
      }
      if(!isCancelled) setDecryptedText((prev)=>({...prev,...result}));
    };
    decryptAll();

    return ()=>{
      isCancelled=true;
    };
  },[sharedKey,oldMessages,message,decryptedText]);
  
  const getMessageText=(m)=>{
    if(!isEncryptedMessage(m.content)) return m.content;
    if(!sharedKey) return "Encrypted Message";
    if(decryptedText[m._id]===undefined) return "Decrypting...";
    return decryptedText[m._id] ?? "Cannot decrypt (key not available)";
  }

  return chatDetails.isLoading ? (
    <Skeleton />
  ) : (
    <Fragment>
      <Box
        sx={{
          minHeight: "5rem",
          px: { xs: 2, sm: 2.5 },
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
          backdropFilter: "blur(10px)",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5} minWidth={0}>
          <AvatarCard avatar={selectedChat?.avatar || []} />
          <Stack minWidth={0}>
            <Typography variant="subtitle1" fontWeight={900} noWrap>
              {conversationTitle}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <LockIcon sx={{ fontSize: 14, color: "text.secondary" }} />
              <Typography variant="caption" color="text.secondary" fontWeight={700} noWrap>
                Private realtime conversation
              </Typography>
            </Stack>
          </Stack>
        </Stack>
        <Box
          sx={{
            display: { xs: "none", sm: "block" },
            px: 1.25,
            py: 0.5,
            borderRadius: 99,
            bgcolor: "action.selected",
            color: "primary.main",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          Secure
        </Box>
      </Box>
      <Stack
        ref={containerRef}
        boxSizing={"border-box"}
        padding={"1rem"}
        spacing={"1rem"}
        height={"calc(90% - 4.5rem)"}
        sx={{
          overflowX: "hidden",
          overflowY: "auto",
          background: (theme) =>
            theme.palette.mode === "light"
              ? "radial-gradient(circle at top left, rgba(37,99,235,0.08), transparent 32rem), #eef2f7"
              : "radial-gradient(circle at top left, rgba(96,165,250,0.16), transparent 32rem), #0f172a",
        }}
      >
        {/* <ChatHeader /> */}

        {allMessages.length > 0 ? (
          allMessages.map((i) => (
            <MessageComponent key={i._id} message={{...i, content:getMessageText(i) }} user={user} />
          ))
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1.5}
            sx={{
              minHeight: "100%",
              textAlign: "center",
              color: "text.secondary",
            }}
          >
            <Box
              sx={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                bgcolor: "action.selected",
                color: "primary.main",
              }}
            >
              <ChatBubbleOutlineIcon sx={{ fontSize: 38 }} />
            </Box>
            <Typography variant="h6" color="text.primary" fontWeight={900}>
              Start the conversation
            </Typography>
            <Typography maxWidth={320}>
              Send a message to {conversationTitle} and it will appear here instantly.
            </Typography>
          </Stack>
        )}

        {userTyping && <TypingLoader />}

        <div ref={bottomRef} />
      </Stack>
      <form
        style={{
          height: "10%",
        }}
        onSubmit={submitHandler}
      >
        <Stack
          direction={"row"}
          height={"100%"}
          padding={"0.85rem 1rem"}
          alignItems={"center"}
          position={"relative"}
          sx={{
            bgcolor: "background.paper",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <IconButton
            sx={{
              position: "absolute",
              left: "1rem",
              rotate: "30deg",
            }}
            onClick={attatchFileMEnuHanlder}
            // ref={fileMenuRef}
          >
            <AttachFileIcon />
          </IconButton>
          <InputBox
            placeholder="Type a message..."
            value={message}
            onChange={messageOnChangeHandler}
          />
          <IconButton
            type="submit"
            sx={{
              bgcolor: "primary.main",
              color: "white",
              marginLeft: "1rem",
              width: 44,
              height: 44,
              "&:hover": {
                bgcolor: "primary.dark",
              },
            }}
          >
            <SendIcon />
          </IconButton>
        </Stack>
      </form>
      <FileMenu anchorEl={fileMenuAnchor} chatId={chatId} />
    </Fragment>
  );
};

const EnhancedChat = Applayout()(Chat);
export default EnhancedChat;
