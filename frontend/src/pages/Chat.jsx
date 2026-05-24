import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { initSocket } from "../services/socket";
import api from "../services/api";
import "./Chat.css";

function Chat() {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [inputMessage, setInputMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  // Group chat states
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // File upload states
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/auth/users");
      setUsers(res.data.users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, []);

  // Fetch chats
  const fetchChats = useCallback(async () => {
    try {
      const res = await api.get("/chats");
      setChats(res.data.chats);
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
      setLoading(false);
    }
  }, []);

  // Fetch messages for selected chat
  const fetchMessages = useCallback(async (chatId) => {
    try {
      const res = await api.get(`/messages/${chatId}`);
      setMessages(res.data.messages);
      
      // Mark all messages in this chat as read
      if (socket && chatId) {
        console.log("Marking chat as read:", chatId);
        socket.emit("mark_chat_read", { chatId });
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  }, [socket]);

  // Create or get chat with a user
  const createOrGetChat = async (userId) => {
    try {
      const res = await api.get(`/chats/user/${userId}`);
      const chat = res.data.chat;

      // Add to chats list if not exists
      setChats(prev => {
        if (!prev.find(c => c._id === chat._id)) {
          return [chat, ...prev];
        }
        return prev;
      });

      setSelectedChat(chat);
      await fetchMessages(chat._id);
      setShowUsers(false);
    } catch (error) {
      console.error("Failed to create/get chat:", error);
      alert("Failed to start chat");
    }
  };

  // Initialize socket
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const newSocket = initSocket(token);
    setSocket(newSocket);
    newSocket.connect();

    newSocket.on("connect", () => {
      console.log("Socket connected");
    });

    newSocket.on("online_users", (users) => {
      setOnlineUsers(users);
    });

    newSocket.on("receive_message", (message) => {
      console.log("Received message:", message);
      setMessages((prev) => {
        if (prev.find((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
      
      // Update chat list with new message
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => c._id === message.chatId);
        if (chatIndex !== -1) {
          const updatedChats = [...prevChats];
          updatedChats[chatIndex].latestMessage = message;
          updatedChats.sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
          );
          return updatedChats;
        }
        return prevChats;
      });

      // Mark as read immediately if this chat is currently open
      if (selectedChat?._id === message.chatId) {
        console.log("Auto-marking message as read:", message._id);
        newSocket.emit("mark_read", { 
          messageId: message._id, 
          chatId: message.chatId 
        });
      }
    });

    newSocket.on("message_sent", (message) => {
      setMessages((prev) => {
        if (prev.find((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
    });

    newSocket.on("message_delivered", ({ messageId, chatId }) => {
      console.log("Message delivered:", messageId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, status: "delivered" } : msg
        )
      );
    });

    newSocket.on("message_read", ({ messageId, chatId, readBy, readAt }) => {
      console.log("Message read:", messageId);
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, status: "read" } : msg
        )
      );
    });

    newSocket.on("user_typing", ({ userId, chatId, isTyping }) => {
      if (selectedChat?._id === chatId) {
        setTypingUsers((prev) => ({
          ...prev,
          [userId]: isTyping,
        }));
        setTimeout(() => {
          setTypingUsers((prev) => ({
            ...prev,
            [userId]: false,
          }));
        }, 3000);
      }
    });

    fetchChats();
    fetchUsers();

    return () => {
      newSocket.disconnect();
    };
  }, [navigate, fetchChats, fetchUsers, selectedChat]);

  // Mark messages as read when selected chat changes or when new messages arrive
  useEffect(() => {
    if (selectedChat && socket && messages.length > 0) {
      // Find unread messages in the current chat
      const unreadMessages = messages.filter(
        msg => msg.senderId?._id !== currentUser._id && msg.status !== "read"
      );
      
      if (unreadMessages.length > 0) {
        console.log(`Marking ${unreadMessages.length} messages as read`);
        socket.emit("mark_chat_read", { chatId: selectedChat._id });
      }
    }
  }, [selectedChat, messages, socket, currentUser._id]);

  // Handle chat selection
  const handleChatSelect = async (chat) => {
    setSelectedChat(chat);
    await fetchMessages(chat._id);
  };

  // Handle sending message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedChat || sending) return;

    setSending(true);
    const messageText = inputMessage;
    setInputMessage("");

    socket.emit("send_message", {
      chatId: selectedChat._id,
      text: messageText,
      messageType: "text",
    });

    setSending(false);
  };

  // Fetch all users for group creation
  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await api.get("/auth/users");
      setAllUsers(res.data.users.filter(u => u._id !== currentUser._id));
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  }, [currentUser._id]);

  // Create group chat
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert("Please enter a group name");
      return;
    }
    
    if (selectedUsers.length < 2) {
      alert("Please select at least 2 users");
      return;
    }

    setCreatingGroup(true);
    try {
      const res = await api.post("/chats/group", {
        groupName: groupName,
        participants: selectedUsers,
      });
      
      setChats(prev => [res.data.chat, ...prev]);
      setShowCreateGroup(false);
      setGroupName("");
      setSelectedUsers([]);
      alert("Group created successfully!");
    } catch (error) {
      console.error("Failed to create group:", error);
      alert(error.response?.data?.message || "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  // Toggle user selection for group
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert("File too large. Maximum size is 50MB");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Send message with media
      socket.emit("send_message", {
        chatId: selectedChat._id,
        text: "",
        media: res.data.url,
        messageType: res.data.messageType,
      });
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload file");
    } finally {
      setUploading(false);
      fileInputRef.current.value = "";
    }
  };

  // Handle typing indicator
  const handleTyping = () => {
    if (!selectedChat) return;

    socket.emit("typing", {
      chatId: selectedChat._id,
      receiverId: !selectedChat.isGroupChat
        ? selectedChat.participants.find((p) => p._id !== currentUser._id)?._id
        : null,
      isTyping: true,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", {
        chatId: selectedChat._id,
        receiverId: !selectedChat.isGroupChat
          ? selectedChat.participants.find((p) => p._id !== currentUser._id)?._id
          : null,
        isTyping: false,
      });
    }, 1000);
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (socket) socket.disconnect();

      // Force hard navigation to login page
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
      // Even if API fails, still clear local storage and redirect
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (socket) socket.disconnect();
      window.location.href = "/login";
    }
  };

  // Format time
  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Check if user is online
  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  // Format last seen time
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return "Never";

    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  // Get chat name
  const getChatName = (chat) => {
    if (chat.isGroupChat) return chat.groupName;
    const otherUser = chat.participants?.find((p) => p._id !== currentUser._id);
    return otherUser?.fullName || "Unknown";
  };

  // Get chat avatar
  const getChatAvatar = (chat) => {
    if (chat.isGroupChat) return chat.groupAvatar?.url || "👥";
    const otherUser = chat.participants?.find((p) => p._id !== currentUser._id);
    return otherUser?.avatar?.url || otherUser?.fullName?.charAt(0) || "👤";
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const typingIndicator = Object.values(typingUsers).some(Boolean);
  const typingUser = Object.keys(typingUsers).find(key => typingUsers[key]);
  const typingUserName = chats
    .flatMap(c => c.participants || [])
    .find(p => p?._id === typingUser)?.fullName;

  // Filter out current user from users list
  const otherUsers = users.filter(u => u._id !== currentUser._id);

  return (
    <>
      {/* Create Group Modal */}
      {showCreateGroup && (
        <div className="modal-overlay" onClick={() => setShowCreateGroup(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Group</h3>
              <button onClick={() => setShowCreateGroup(false)}>✕</button>
            </div>
            
            <input
              type="text"
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="group-name-input"
            />
            
            <div className="users-select-list">
              <h4>Select Members (min 2)</h4>
              {allUsers.map(user => (
                <div
                  key={user._id}
                  className={`user-select-item ${selectedUsers.includes(user._id) ? "selected" : ""}`}
                  onClick={() => toggleUserSelection(user._id)}
                >
                  <div className="user-avatar-small">
                    <span className="avatar-placeholder-small">
                      {user.fullName?.charAt(0) || "U"}
                    </span>
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.fullName}</div>
                  </div>
                  {selectedUsers.includes(user._id) && (
                    <span className="check-mark">✓</span>
                  )}
                </div>
              ))}
            </div>
            
            <div className="modal-footer">
              <button onClick={() => setShowCreateGroup(false)} className="cancel-btn">
                Cancel
              </button>
              <button onClick={handleCreateGroup} disabled={creatingGroup} className="create-btn">
                {creatingGroup ? "Creating..." : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Info Modal */}
      {showGroupInfo && selectedChat?.isGroupChat && (
        <div className="modal-overlay" onClick={() => setShowGroupInfo(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Group Info</h3>
              <button onClick={() => setShowGroupInfo(false)}>✕</button>
            </div>
            
            <div className="group-info">
              <p><strong>Group Name:</strong> {selectedChat.groupName}</p>
              <p><strong>Created:</strong> {new Date(selectedChat.createdAt).toLocaleDateString()}</p>
              <p><strong>Admin:</strong> {selectedChat.groupadmin?.fullName}</p>
              <p><strong>Members ({selectedChat.participants?.length || 0})</strong></p>
              <div className="members-list">
                {selectedChat.participants?.map(member => (
                  <div key={member._id} className="member-item">
                    <span>{member.fullName}</span>
                    {member._id === selectedChat.groupadmin?._id && (
                      <span className="admin-badge">Admin</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="chat-container">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2>Chats</h2>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => {
              fetchAllUsers();
              setShowCreateGroup(true);
            }} className="logout-btn">
              New Group
            </button>
            <button onClick={() => setShowUsers(!showUsers)} className="logout-btn">
              New Chat
            </button>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>

        {showUsers && (
          <div className="users-list">
            <div className="users-header">
              <h3>Select a user to chat</h3>
              <button onClick={() => setShowUsers(false)}>✕</button>
            </div>
            {otherUsers.map((user) => (
              <div
                key={user._id}
                className="user-item"
                onClick={() => createOrGetChat(user._id)}
              >
                <div className="user-avatar">
                  <span className="avatar-placeholder">
                    {user.fullName?.charAt(0) || "U"}
                  </span>
                </div>
                <div className="user-info">
                  <div className="user-name">
                    {user.fullName}
                    <span className={`online-status ${isUserOnline(user._id) ? "online" : "offline"}`} />
                  </div>
                  <div className="user-last-seen">
                    {!isUserOnline(user._id) && user.lastSeen && (
                      <small>Last seen: {formatLastSeen(user.lastSeen)}</small>
                    )}
                    {isUserOnline(user._id) && (
                      <small className="online-text">Online</small>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="chats-list">
          {chats.length === 0 ? (
            <div className="no-chats">
              <p>No chats yet</p>
              <p>Click "New Chat" to start messaging</p>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat._id}
                className={`chat-item ${selectedChat?._id === chat._id ? "active" : ""}`}
                onClick={() => handleChatSelect(chat)}
              >
                <div className="chat-avatar">
                  {typeof getChatAvatar(chat) === "string" && getChatAvatar(chat).startsWith("http") ? (
                    <img src={getChatAvatar(chat)} alt="" />
                  ) : (
                    <span className="avatar-placeholder">{getChatAvatar(chat)}</span>
                  )}
                </div>
                <div className="chat-info">
                  <div className="chat-name">
                    {getChatName(chat)}
                    {!chat.isGroupChat && (
                      <span className={`online-status ${isUserOnline(
                        chat.participants?.find((p) => p._id !== currentUser._id)?._id
                      ) ? "online" : "offline"}`} />
                    )}
                  </div>
                  <div className="chat-last-message">
                    {chat.latestMessage?.text?.slice(0, 30) || "No messages yet"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div className="chat-header-info">
                <div className="chat-avatar large">
                  {typeof getChatAvatar(selectedChat) === "string" && getChatAvatar(selectedChat).startsWith("http") ? (
                    <img src={getChatAvatar(selectedChat)} alt="" />
                  ) : (
                    <span className="avatar-placeholder">{getChatAvatar(selectedChat)}</span>
                  )}
                </div>
                <div>
                  <h3>{getChatName(selectedChat)}</h3>
                  {!selectedChat.isGroupChat ? (
                    <p className="chat-status">
                      {isUserOnline(
                        selectedChat.participants?.find((p) => p._id !== currentUser._id)?._id
                      ) ? (
                        <span style={{ color: "#4caf50" }}>● Online</span>
                      ) : (
                        <span style={{ color: "#999", fontSize: "12px" }}>
                          Last seen {formatLastSeen(
                            users.find(u => u._id === selectedChat.participants?.find((p) => p._id !== currentUser._id)?._id
                            )?.lastSeen
                          )}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="chat-status">
                      {selectedChat.participants?.length} members
                    </p>
                  )}
                </div>
              </div>
              
              {/* Add Group Info button for group chats */}
              {selectedChat.isGroupChat && (
                <button onClick={() => setShowGroupInfo(true)} className="info-btn">
                  ℹ️ Group Info
                </button>
              )}
            </div>

            {/* Messages Area */}
            <div className="messages-area">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet</p>
                  <p>Send a message to start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`message ${msg.senderId?._id === currentUser._id ? "sent" : "received"}`}
                  >
                    {msg.senderId?._id !== currentUser._id && msg.senderId && (
                      <div className="message-sender">{msg.senderId.fullName}</div>
                    )}
                    <div className="message-bubble">
                      {msg.messageType === "image" && msg.media && (
                        <img src={msg.media} alt="Shared" className="message-media" />
                      )}
                      {msg.messageType === "video" && msg.media && (
                        <video src={msg.media} controls className="message-media" />
                      )}
                      {msg.messageType === "audio" && msg.media && (
                        <audio src={msg.media} controls className="message-media" style={{ maxWidth: "100%" }} />
                      )}
                      {msg.messageType === "file" && msg.media && (
                        <div className="message-file">
                          <a href={msg.media} target="_blank" rel="noopener noreferrer" className="file-attachment-link" style={{ display: "flex", alignItems: "center", gap: "8px", color: "inherit", textDecoration: "underline" }}>
                            📄 {msg.media.split('/').pop() || "Download File"}
                          </a>
                        </div>
                      )}
                      {msg.text && <div className="message-text">{msg.text}</div>}
                      <div className="message-info">
                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                        {msg.senderId?._id === currentUser._id && (
                          <span className="message-status">
                            {msg.status === "read" ? (
                              <span style={{ color: "#4a9eff", fontWeight: "bold" }}>✓✓</span> // Blue double tick
                            ) : msg.status === "delivered" ? (
                              <span style={{ color: "#666" }}>✓✓</span> // Grey double tick
                            ) : (
                              <span style={{ color: "#999" }}>✓</span> // Grey single tick
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              {typingIndicator && (
                <div className="typing-indicator">
                  <span>{typingUserName || "Someone"} is typing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="input-area">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: "none" }}
                accept="image/*,video/*,application/pdf,.doc,.docx,.txt"
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="attach-btn"
                disabled={uploading}
                title="Attach file"
              >
                {uploading ? "⏳" : "📎"}
              </button>
              
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                onKeyDown={handleTyping}
                placeholder="Type a message..."
                disabled={sending || uploading}
              />
              
              <button onClick={handleSendMessage} disabled={sending || !inputMessage.trim()}>
                {sending ? "..." : "Send"}
              </button>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <p>Select a chat or click "New Chat" to start messaging</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export default Chat;