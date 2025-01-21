"use client";

import { useState, useEffect, useRef } from "react";
import {
  auth,
  db,
  createUserDocument,
  addPrivateMessage,
} from "../../lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import {
  Smile,
  Send,
  LogOut,
  User,
  Settings,
  UserPlus,
  ChevronLeft,
  Image,
  Menu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Timestamp } from "firebase/firestore";

interface Message {
  id: string;
  text: string;
  userId: string;
  userName: string;
  timestamp: Timestamp | number;
  sticker?: string;
}

interface PrivateMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: number | Date; // Use number (UNIX timestamp) or Date for clarity
}

interface OnlineUser {
  id: string;
  username: string;
}

export default function ChatRoom() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [privateMessages, setPrivateMessages] = useState<{
    [key: string]: PrivateMessage[];
  }>({});
  const [newMessage, setNewMessage] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [theme, setTheme] = useState("light");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [friendRequests, setFriendRequests] = useState<
    { id: string; username: string }[]
  >([]);
  const [friends, setFriends] = useState<{ id: string; username: string }[]>(
    []
  );
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [customStickers, setCustomStickers] = useState<string[]>([]);
  const [isCustomStickerPickerOpen, setIsCustomStickerPickerOpen] =
    useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (user) {
      createUserDocument(user);

      const q = query(
        collection(db, "messages"),
        orderBy("timestamp", "desc"),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedMessages: Message[] = [];
        querySnapshot.forEach((doc) => {
          fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
        });
        setMessages(fetchedMessages.reverse());
      });

      const onlineUsersUnsubscribe = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          const users: OnlineUser[] = [];
          snapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.online && doc.id !== user.uid) {
              users.push({
                id: doc.id,
                username: userData.displayName || userData.email,
              });
            }
          });
          setOnlineUsers(users);
        }
      );

      const userDocRef = doc(db, "users", user.uid);
      const userDocUnsubscribe = onSnapshot(userDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as {
            friendRequests?: string[];
            friends?: string[];
            customStickers?: string[]; // Assuming stickers are stored as strings (e.g., URLs)
          };

          const fetchedFriendRequests = userData.friendRequests || [];
          const friendRequestsData = await Promise.all(
            fetchedFriendRequests.map(async (requestId: string) => {
              const userDoc = await getDoc(doc(db, "users", requestId));
              if (userDoc.exists()) {
                const requestData = userDoc.data() as {
                  username?: string;
                  email?: string;
                };
                return {
                  id: requestId,
                  username:
                    requestData.username || requestData.email || "Unknown User",
                };
              }
              return { id: requestId, username: "Unknown User" };
            })
          );
          setFriendRequests(friendRequestsData);

          setCustomStickers(userData.customStickers || []);

          const fetchedFriends = userData.friends || [];
          const friendsData = await Promise.all(
            fetchedFriends.map(async (friendId: string) => {
              const friendDoc = await getDoc(doc(db, "users", friendId));
              if (friendDoc.exists()) {
                const friendData = friendDoc.data() as {
                  username?: string;
                  email?: string;
                };
                return {
                  id: friendId,
                  username:
                    friendData.username || friendData.email || "Unknown User",
                };
              }
              return { id: friendId, username: "Unknown User" };
            })
          );
          setFriends(friendsData);
        }
      });

      updateDoc(userDocRef, { online: true });

      return () => {
        unsubscribe();
        onlineUsersUnsubscribe();
        userDocUnsubscribe();
        updateDoc(userDocRef, { online: false });
      };
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user && selectedFriend) {
      const chatId = [user.uid, selectedFriend].sort().join("_");
      const q = query(
        collection(db, `privateChats/${chatId}/messages`),
        orderBy("timestamp", "asc")
      );
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const fetchedMessages: PrivateMessage[] = [];
        querySnapshot.forEach((doc) => {
          fetchedMessages.push({ id: doc.id, ...doc.data() } as PrivateMessage);
        });
        setPrivateMessages((prev) => ({
          ...prev,
          [selectedFriend]: fetchedMessages,
        }));
      });

      return () => unsubscribe();
    }
  }, [user, selectedFriend]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, privateMessages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((newMessage.trim() || isCustomStickerPickerOpen) && user) {
      try {
        if (selectedFriend) {
          await addPrivateMessage(user.uid, selectedFriend, newMessage);
        } else {
          await addDoc(collection(db, "messages"), {
            text: newMessage,
            userId: user.uid,
            userName: user.displayName || user.email,
            timestamp: new Date(),
            sticker: isCustomStickerPickerOpen ? newMessage : null,
          });
        }
        setNewMessage("");
        setIsCustomStickerPickerOpen(false);
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await updateDoc(doc(db, "users", user!.uid), { online: false });
      await auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    setIsEmojiPickerOpen(false);
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const sendFriendRequest = async (userId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), {
        friendRequests: arrayUnion(user!.uid),
      });
    } catch (error) {
      console.error("Error sending friend request:", error);
    }
  };

  const acceptFriendRequest = async (userId: string) => {
    setFriendRequests((prev) =>
      prev.filter((request) => request.id !== userId)
    );
    try {
      await updateDoc(doc(db, "users", user!.uid), {
        friends: arrayUnion(userId),
        friendRequests: arrayRemove(userId),
      });
      await updateDoc(doc(db, "users", userId), {
        friends: arrayUnion(user!.uid),
      });
    } catch (error) {
      console.error("Error accepting friend request:", error);
    }
  };

  const handleCustomStickerUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          await updateDoc(doc(db, "users", user!.uid), {
            customStickers: arrayUnion(base64String),
          });
        } catch (error) {
          console.error("Error uploading custom sticker:", error);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div
      className={`flex flex-col h-screen ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-100"
      }`}
    >
      <header
        className={`${
          theme === "dark" ? "bg-gray-800" : "bg-white"
        } shadow-md p-4`}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className={`mr-4 ${
                theme === "dark" ? "text-gray-300" : "text-gray-600"
              } lg:hidden`}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-blue-600">
              Awesome Chat
            </h1>
          </div>
          <div className="flex items-center space-x-2 md:space-x-4">
            <span
              className={`${
                theme === "dark" ? "text-gray-300" : "text-gray-600"
              } hidden md:inline`}
            >
              Welcome, {user.displayName || user.email}
            </span>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-full ${
                theme === "dark"
                  ? "bg-gray-700 text-yellow-400"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              <Settings size={20} />
            </button>
            <button
              onClick={handleSignOut}
              className="bg-red-500 text-white px-2 py-1 md:px-4 md:py-2 rounded hover:bg-red-600 transition duration-200 flex items-center"
            >
              <LogOut size={20} className="mr-0 md:mr-2" />{" "}
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence>
          {isPanelOpen && (
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              exit={{ width: 0 }}
              className={`${
                theme === "dark" ? "bg-gray-800" : "bg-white"
              } p-4 overflow-y-auto w-full md:w-64 lg:w-80 absolute md:relative z-10`}
            >
              <button
                onClick={() => setIsPanelOpen(false)}
                className="md:hidden absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              >
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-xl font-bold mb-4">Online Users</h2>
              <ul>
                {onlineUsers.map((onlineUser) => (
                  <li
                    key={onlineUser.id}
                    className="flex items-center justify-between mb-2"
                  >
                    <span>{onlineUser.username}</span>
                    <button
                      onClick={() => sendFriendRequest(onlineUser.id)}
                      className="text-blue-500 hover:text-blue-600"
                    >
                      <UserPlus size={20} />
                    </button>
                  </li>
                ))}
              </ul>
              <h2 className="text-xl font-bold mt-6 mb-4">Friend Requests</h2>
              <ul>
                {friendRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex items-center justify-between mb-2"
                  >
                    <span>{request.username}</span>
                    <button
                      onClick={() => acceptFriendRequest(request.id)}
                      className="bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                    >
                      Accept
                    </button>
                  </li>
                ))}
              </ul>
              <h2 className="text-xl font-bold mt-6 mb-4">Friends</h2>
              <ul>
                {friends.map((friend) => (
                  <li
                    key={friend.id}
                    className="flex items-center justify-between mb-2"
                  >
                    <span>{friend.username}</span>
                    <button
                      onClick={() => setSelectedFriend(friend.id)}
                      className={`px-2 py-1 rounded ${
                        selectedFriend === friend.id
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                      }`}
                    >
                      Chat
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-grow overflow-y-auto p-4 space-y-4">
            <AnimatePresence>
              {selectedFriend
                ? privateMessages[selectedFriend]?.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className={`p-3 rounded-lg max-w-[80%] md:max-w-md ${
                        message.senderId === user.uid
                          ? "bg-blue-500 text-white ml-auto"
                          : theme === "dark"
                          ? "bg-gray-700 text-white"
                          : "bg-white text-gray-800"
                      }`}
                    >
                      <p className="text-sm md:text-base">{message.text}</p>
                      <p className="text-xs mt-1 opacity-75">
                        {message.timestamp
                          ? (message.timestamp instanceof Timestamp
                              ? message.timestamp.toDate()
                              : new Date(message.timestamp)
                            ).toLocaleString()
                          : "Sending..."}
                      </p>
                    </motion.div>
                  ))
                : messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                      className={`p-3 rounded-lg max-w-[80%] md:max-w-md ${
                        message.userId === user.uid
                          ? "bg-blue-500 text-white ml-auto"
                          : theme === "dark"
                          ? "bg-gray-700 text-white"
                          : "bg-white text-gray-800"
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        <User size={16} className="mr-2" />
                        <p className="font-bold text-sm">{message.userName}</p>
                      </div>
                      {message.sticker ? (
                        <img
                          src={message.sticker || "/placeholder.svg"}
                          alt="Custom sticker"
                          className="max-w-full h-auto"
                        />
                      ) : (
                        <p className="text-sm md:text-base">{message.text}</p>
                      )}
                      <p className="text-xs mt-1 opacity-75">
                        {message.timestamp
                          ? typeof message.timestamp === "object" &&
                            "toDate" in message.timestamp
                            ? message.timestamp.toDate().toLocaleString() // Firestore Timestamp
                            : new Date(message.timestamp).toLocaleString() // Unix timestamp (number) or Date object
                          : "Sending..."}
                      </p>
                    </motion.div>
                  ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </main>
          <footer
            className={`${
              theme === "dark" ? "bg-gray-800" : "bg-white"
            } p-2 md:p-4 border-t`}
          >
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <div className="relative flex-grow">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={
                    selectedFriend
                      ? "Type a private message..."
                      : "Type a message..."
                  }
                  className={`w-full p-2 pr-20 text-sm md:text-base border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    theme === "dark"
                      ? "bg-gray-700 text-white"
                      : "bg-white text-gray-800"
                  }`}
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
                  <button
                    type="button"
                    onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Smile size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIsCustomStickerPickerOpen(!isCustomStickerPickerOpen)
                    }
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Image size={20} />
                  </button>
                </div>
                {isEmojiPickerOpen && (
                  <div
                    className={`absolute bottom-full mb-2 p-2 rounded-lg shadow-lg ${
                      theme === "dark" ? "bg-gray-700" : "bg-white"
                    }`}
                  >
                    {["😊", "😂", "🎉", "❤️", "👍", "🔥"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiClick(emoji)}
                        className={`p-1 hover:bg-gray-100 rounded ${
                          theme === "dark"
                            ? "hover:bg-gray-600"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                {isCustomStickerPickerOpen && (
                  <div
                    className={`absolute bottom-full mb-2 p-2 rounded-lg shadow-lg ${
                      theme === "dark" ? "bg-gray-700" : "bg-white"
                    }`}
                  >
                    {customStickers.map((sticker, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setNewMessage(sticker);
                          setIsCustomStickerPickerOpen(false);
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <img
                          src={sticker || "/placeholder.svg"}
                          alt="Custom sticker"
                          className="w-8 h-8"
                        />
                      </button>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Image size={20} />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleCustomStickerUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                )}
              </div>
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded-full hover:bg-blue-600 transition duration-200 flex items-center"
              >
                <Send size={20} className="mr-0 md:mr-2" />{" "}
                <span className="hidden md:inline">Send</span>
              </button>
            </form>
          </footer>
        </div>
      </div>
    </div>
  );
}
