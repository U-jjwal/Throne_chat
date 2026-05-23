import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StatusBar,
  Dimensions,
  ScrollView,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import socketService from '../services/socket';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

export default function ChatScreen({ navigation }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      if (selectedChatRef.current) {
        await fetchMessages(selectedChatRef.current._id);
      } else {
        await Promise.all([fetchChats(), fetchUsers()]);
      }
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchChats, fetchUsers]);
  
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const selectedChatRef = useRef(null);

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  useEffect(() => {
    initializeApp();

    return () => {
      if (socket) socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const initializeApp = async () => {
    await loadCurrentUser();
    await initializeSocket();
    await fetchChats();
    await fetchUsers();
  };

  const loadCurrentUser = async () => {
    const userStr = await AsyncStorage.getItem('user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    } else {
      navigation.replace('Login');
    }
  };

  const initializeSocket = async () => {
    const newSocket = await socketService.connect();
    if (!newSocket) return;
    
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('✅ Socket connected'));
    newSocket.on('disconnect', () => console.log('❌ Socket disconnected'));
    newSocket.on('connect_error', async (err) => {
      console.error('❌ Socket connection error:', err.message);
      if (err.message === 'Invalid Token' || err.message === 'Unauthorized') {
        Alert.alert('Session Expired', 'Please log in again to sync with the production server.');
        await AsyncStorage.multiRemove(['token', 'user']);
        navigation.replace('Login');
      }
    });
    newSocket.on('online_users', setOnlineUsers);

    newSocket.on('receive_message', (message) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setMessages(prev => prev.find(m => m._id === message._id) ? prev : [...prev, message]);
      
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(c => c._id === message.chatId);
        if (chatIndex !== -1) {
          const updatedChats = [...prevChats];
          updatedChats[chatIndex].latestMessage = message;
          updatedChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          return updatedChats;
        }
        return prevChats;
      });
      setFilteredChats(prev => {
        const chatIndex = prev.findIndex(c => c._id === message.chatId);
        if (chatIndex !== -1) {
          const updated = [...prev];
          updated[chatIndex].latestMessage = message;
          updated.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          return updated;
        }
        return prev;
      });

      if (selectedChatRef.current?._id === message.chatId && message.senderId?._id !== currentUser?._id) {
        newSocket.emit('mark_read', { messageId: message._id, chatId: message.chatId });
      }
      
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    newSocket.on('message_sent', (message) => {
      setMessages(prev => {
        const index = prev.findIndex(m => (message.tempId && m._id === message.tempId) || m._id === message._id);
        if (index !== -1) {
          const updated = [...prev];
          updated[index] = message;
          return updated;
        }
        return [...prev, message];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    newSocket.on('message_delivered', ({ messageId }) => {
      setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, status: 'delivered' } : msg));
    });

    newSocket.on('message_read', ({ messageId }) => {
      setMessages(prev => prev.map(msg => msg._id === messageId ? { ...msg, status: 'read' } : msg));
    });

    newSocket.on('user_typing', ({ userId, chatId, isTyping }) => {
      if (selectedChatRef.current?._id === chatId && userId !== currentUser?._id) {
        setTypingUsers(prev => ({ ...prev, [userId]: isTyping }));
        setTimeout(() => setTypingUsers(prev => ({ ...prev, [userId]: false })), 3000);
      }
    });

    newSocket.on('error', (err) => {
      console.error('Socket Server Error:', err);
      Alert.alert('Server Error', err.message || 'An error occurred on the server.');
    });
  };

  const fetchChats = async () => {
    try {
      const response = await api.get('/chats');
      setChats(response.data.chats);
      setFilteredChats(response.data.chats);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data.users);
      setFilteredUsers(response.data.users.filter(u => u._id !== currentUser?._id));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchMessages = async (chatId) => {
    try {
      const response = await api.get(`/messages/${chatId}`);
      setMessages(response.data.messages);
      
      if (socket?.connected && chatId) {
        socket.emit('mark_chat_read', { chatId });
      }
      
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    fetchMessages(chat._id);
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !selectedChat) return;
    if (!socket?.connected) {
      Alert.alert('Error', 'Not connected to server');
      return;
    }

    const messageText = inputMessage;
    setInputMessage('');

    // Generate a temporary unique ID for instantaneous UI display
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      chatId: selectedChat._id,
      senderId: {
        _id: currentUser?._id,
        fullName: currentUser?.fullName,
        avatar: currentUser?.avatar,
      },
      text: messageText,
      media: "",
      messageType: 'text',
      status: 'sending',
      createdAt: new Date().toISOString(),
    };

    // Append message to UI instantly
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);

    socket.emit('send_message', {
      chatId: selectedChat._id,
      text: messageText,
      messageType: 'text',
      tempId,
    });
  };
  const handlePickAndUploadFile = async () => {
    // Request system permissions to pick media
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need media library permissions to send files.');
        return;
      }

      try {
        // Open the gallery with SDK 54 compatible array specifications
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'],
          allowsEditing: false,
          quality: 0.8,
        });

        if (result.canceled || !result.assets || result.assets.length === 0) {
          return;
        }

        const selectedAsset = result.assets[0];
        const localUri = selectedAsset.uri;
        const filename = localUri.split('/').pop() || 'upload.jpg';
        
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        // Assemble FormData container key for the multer 'file' middleware
        const formData = new FormData();
        formData.append('file', {
          uri: localUri,
          name: filename,
          type: type,
        });

        Alert.alert('Uploading', 'Uploading media file, please wait...');

        // CRITICAL: We use native fetch here without specifying a manual multipart header.
        // This lets the runtime formulate a clean boundary value automatically, preventing upload crash errors.
        const token = await AsyncStorage.getItem('token');
      const uploadUrl = `${api.defaults.baseURL}/upload`;
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      const responseData = await response.json();

      if (responseData && responseData.url) {
        socket.emit('send_message', {
          chatId: selectedChat._id,
          text: responseData.messageType === 'text' ? '' : `Sent a ${responseData.messageType}`,
          media: responseData.url,
          messageType: responseData.messageType || 'image',
        });
      } else {
        Alert.alert('Error', responseData.message || 'Failed to upload media');
      }
    } catch (err) {
      console.error('File upload error:', err);
      Alert.alert('Error', 'Upload failed: ' + err.message);
    }
  };

  const handleTyping = () => {
    if (!selectedChat || !socket?.connected) return;

    socket.emit('typing', {
      chatId: selectedChat._id,
      receiverId: !selectedChat.isGroupChat 
        ? selectedChat.participants?.find(p => p._id !== currentUser?._id)?._id 
        : null,
      isTyping: true,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (socket?.connected) {
        socket.emit('typing', {
          chatId: selectedChat._id,
          receiverId: !selectedChat.isGroupChat 
            ? selectedChat.participants?.find(p => p._id !== currentUser?._id)?._id 
            : null,
          isTyping: false,
        });
      }
    }, 1000);
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Fire and forget server-side logout so the local session clears instantly even on server hang
              api.post('/auth/logout').catch((err) => console.error('Server logout failed:', err));
              
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
              socketService.disconnect();
              navigation.replace('Login');
            } catch (error) {
              console.error('Logout failed:', error);
            }
          }
        }
      ]
    );
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter group name');
      return;
    }
    if (selectedUsers.length < 2) {
      Alert.alert('Error', 'Please select at least 2 users');
      return;
    }

    try {
      const response = await api.post('/chats/group', {
        groupName: groupName,
        participants: selectedUsers,
      });

      setChats(prev => [response.data.chat, ...prev]);
      setFilteredChats(prev => [response.data.chat, ...prev]);
      setShowCreateGroup(false);
      setGroupName('');
      setSelectedUsers([]);
      Alert.alert('Success', 'Group created successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create group');
    }
  };

  const createOrGetChat = async (userId) => {
    try {
      const response = await api.get(`/chats/user/${userId}`);
      const chat = response.data.chat;

      setChats(prev => {
        if (!prev.find(c => c._id === chat._id)) {
          return [chat, ...prev];
        }
        return prev;
      });
      setFilteredChats(prev => {
        if (!prev.find(c => c._id === chat._id)) {
          return [chat, ...prev];
        }
        return prev;
      });

      setSelectedChat(chat);
      await fetchMessages(chat._id);
      setShowCreateGroup(false);
      setShowUsersModal(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to start chat');
    }
  };

  const handleSearchUsers = (text) => {
    setUserSearchQuery(text);
    if (!text.trim()) {
      setFilteredUsers(users.filter(u => u._id !== currentUser?._id));
    } else {
      const filtered = users.filter(u => 
        u._id !== currentUser?._id &&
        u.fullName?.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSearchChats = (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setFilteredChats(chats);
    } else {
      const filtered = chats.filter(chat => 
        getChatName(chat).toLowerCase().includes(text.toLowerCase())
      );
      setFilteredChats(filtered);
    }
  };

  const isRecipientTyping = () => {
    if (!selectedChatRef.current) return false;
    return Object.entries(typingUsers).some(([userId, isTyping]) => {
      if (!isTyping) return false;
      if (selectedChatRef.current.isGroupChat) {
        return selectedChatRef.current.participants?.some(p => p._id === userId && p._id !== currentUser?._id);
      } else {
        const otherUser = selectedChatRef.current.participants?.find(p => p._id !== currentUser?._id);
        return otherUser?._id === userId;
      }
    });
  };

  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Offline';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Offline';
      
      const now = new Date();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // If the date is today
      if (date.toDateString() === now.toDateString()) {
        return `Last seen today at ${timeStr}`;
      }
      
      // If the date was yesterday
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return `Last seen yesterday at ${timeStr}`;
      }
      
      // Otherwise return month and day
      const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `Last seen on ${dateStr} at ${timeStr}`;
    } catch (e) {
      return 'Offline';
    }
  };

  const isUserOnline = (userId) => onlineUsers.includes(userId);
  
  const getChatName = (chat) => {
    if (chat.isGroupChat) return chat.groupName;
    const otherUser = chat.participants?.find(p => p._id !== currentUser?._id);
    return otherUser?.fullName || 'Unknown';
  };

  const formatTime = (date) => {
    if (!date) return '';
    const msgDate = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now - msgDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else {
      return msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const formatMessageTime = (date) => {
    if (!date) return '';
    const msgDate = new Date(date);
    return msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderChatItem = ({ item }) => {
    const otherUserId = !item.isGroupChat 
      ? item.participants?.find(p => p._id !== currentUser?._id)?._id 
      : null;
    const isOnline = otherUserId ? isUserOnline(otherUserId) : false;
    const chatName = getChatName(item);
    const lastMessage = item.latestMessage?.text?.slice(0, 35) || 'Tap to start chatting';
    const time = formatTime(item.updatedAt);
    const unreadCount = 0;

    return (
      <TouchableOpacity
        style={[styles.chatItem, { backgroundColor: theme.background }]}
        onPress={() => handleChatSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.chatAvatar}>
          <Text style={styles.avatarText}>{chatName.charAt(0).toUpperCase()}</Text>
          {!item.isGroupChat && isOnline && <View style={styles.onlineBadge} />}
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatRow}>
            <Text style={[styles.chatName, { color: theme.text }]} numberOfLines={1}>{chatName}</Text>
            <Text style={[styles.chatTime, { color: theme.textSecondary }]}>{time}</Text>
          </View>
          <Text style={[styles.lastMessage, { color: theme.textSecondary }]} numberOfLines={1}>
            {lastMessage}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }) => {
    const isSent = item.senderId?._id === currentUser?._id;
    const hasMedia = !!item.media;
    
    return (
      <View style={[styles.messageContainer, isSent ? styles.sentContainer : styles.receivedContainer]}>
        <View style={[
          styles.messageBubble,
          isSent ? [styles.sentBubble, { backgroundColor: theme.sentBubble }] : [styles.receivedBubble, { backgroundColor: theme.receivedBubble }],
          hasMedia && { padding: 4, borderRadius: 12, maxWidth: '85%' }
        ]}>
          {!isSent && item.senderId && (
            <Text style={[styles.messageSender, { color: theme.textSecondary, marginHorizontal: 8, marginTop: 4 }]}>
              {item.senderId.fullName}
            </Text>
          )}
          {hasMedia ? (
            <Image source={{ uri: item.media }} style={styles.messageImage} resizeMode="cover" />
          ) : (
            item.text && <Text style={[styles.messageText, { color: isSent ? theme.sentText : theme.receivedText }]}>{item.text}</Text>
          )}
          <View style={[styles.messageFooter, hasMedia && { paddingHorizontal: 8, paddingBottom: 4 }]}>
            <Text style={[styles.messageTime, { color: isSent ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
              {formatMessageTime(item.createdAt)}
            </Text>
            {isSent && (
              <Text style={[styles.messageStatus, item.status === 'read' && styles.readStatus]}>
                {item.status === 'read' ? '✓✓' : item.status === 'delivered' ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.userItem, { backgroundColor: theme.background, borderBottomColor: theme.border }]}
      onPress={() => createOrGetChat(item._id)}
      activeOpacity={0.7}
    >
      <View style={styles.userAvatar}>
        <Text style={styles.avatarText}>{item.fullName?.charAt(0).toUpperCase()}</Text>
        {isUserOnline(item._id) && <View style={styles.onlineBadgeSmall} />}
      </View>
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.text }]}>{item.fullName}</Text>
        <Text style={[styles.userStatus, { color: theme.textSecondary }]}>
          {isUserOnline(item._id) ? 'Online' : 'Offline'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderGroupUserItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.userItem, { backgroundColor: theme.background, borderBottomColor: theme.border }]}
      onPress={() => toggleUserSelection(item._id)}
      activeOpacity={0.7}
    >
      <View style={styles.userAvatar}>
        <Text style={styles.avatarText}>{item.fullName?.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: theme.text }]}>{item.fullName}</Text>
        <Text style={[styles.userStatus, { color: theme.textSecondary }]}>
          {isUserOnline(item._id) ? 'Online' : 'Offline'}
        </Text>
      </View>
      {selectedUsers.includes(item._id) && (
        <View style={styles.checkMarkContainer}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (loading || !currentUser) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Full-screen chat view
  if (selectedChat) {
    const otherParticipant = selectedChat.participants?.find(p => p._id !== currentUser?._id);
    const isOnline = otherParticipant ? isUserOnline(otherParticipant._id) : false;
    const recipientTyping = isRecipientTyping();

    return (
      <View style={[styles.fullScreenChat, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
        
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Chat Header */}
          <View style={[styles.chatHeader, { backgroundColor: theme.headerBackground, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setSelectedChat(null)} style={styles.backButton}>
              <Text style={[styles.backButtonText, { color: theme.primary }]}>←</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.chatHeaderInfo}>
              <View style={styles.chatAvatarSmall}>
                <Text style={styles.avatarTextSmall}>{getChatName(selectedChat).charAt(0).toUpperCase()}</Text>
              </View>
              <View>
                <Text style={[styles.chatHeaderName, { color: theme.text }]}>{getChatName(selectedChat)}</Text>
                {!selectedChat.isGroupChat && (
                  <Text style={[styles.chatHeaderStatus, { color: recipientTyping ? '#25D366' : (isOnline ? '#25D366' : theme.textSecondary) }]}>
                    {recipientTyping ? 'typing...' : (isOnline ? 'Online' : formatLastSeen(otherParticipant?.lastSeen))}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item._id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContainer}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.primary]}
                tintColor={theme.primary}
              />
            }
          />

          {/* Typing Indicator */}
          {Object.values(typingUsers).some(Boolean) && (
            <View style={styles.typingContainer}>
              <Text style={[styles.typingText, { color: theme.textSecondary }]}>typing...</Text>
            </View>
          )}

          {/* Input Bar */}
          <View style={[styles.inputContainer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <TouchableOpacity style={styles.attachButton} onPress={handlePickAndUploadFile}>
              <Text style={styles.attachIcon}>➕</Text>
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
              placeholder="Message"
              placeholderTextColor={theme.textSecondary}
              value={inputMessage}
              onChangeText={setInputMessage}
              onChange={handleTyping}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, (!inputMessage.trim() || sending) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!inputMessage.trim() || sending}
            >
              <View style={[styles.sendButtonCircle, { backgroundColor: theme.primary }]}>
                <Text style={styles.sendIcon}>➤</Text>
              </View>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // Main Chat List View
  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme.statusBar === 'dark' ? 'dark-content' : 'light-content'} />
      
      {/* Header */}
      <View style={[styles.mainHeader, { backgroundColor: theme.headerBackground }]}>
        <Text style={[styles.mainTitle, { color: theme.text }]}>Chats</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconButton}>
            <Text style={[styles.iconText, { color: theme.primary }]}>{isDarkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={styles.iconButton}>
            <Text style={[styles.iconText, { color: theme.primary }]}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Three-dot Menu */}
      {showMenu && (
        <TouchableOpacity 
          style={styles.menuOverlay} 
          activeOpacity={1} 
          onPress={() => setShowMenu(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: theme.surface, shadowColor: '#000' }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => {
              setShowMenu(false);
              setShowCreateGroup(true);
            }}>
              <Text style={[styles.menuItemText, { color: theme.text }]}>New Group</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
              <Text style={[styles.menuItemText, { color: theme.text }]}>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Text style={[styles.menuItemText, { color: '#FF3B30' }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surface, marginHorizontal: 12, marginTop: 8 }]}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search"
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={handleSearchChats}
        />
      </View>

      {/* Chat List */}
      <FlatList
        data={filteredChats}
        renderItem={renderChatItem}
        keyExtractor={item => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.chatList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No chats yet</Text>
          </View>
        )}
      />

      {/* Floating Action Button - Opens Users Modal */}
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => {
          setUserSearchQuery('');
          setFilteredUsers(users.filter(u => u._id !== currentUser?._id));
          setShowUsersModal(true);
        }}
      >
        <Text style={styles.fabIcon}>💬</Text>
      </TouchableOpacity>

      {/* New Chat Modal (User Selector) */}
      <Modal visible={showUsersModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={() => {
                setShowUsersModal(false);
                setUserSearchQuery('');
              }}>
                <Text style={[styles.modalCancel, { color: theme.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>New Chat</Text>
              <View style={{ width: 50 }} />
            </View>
            
            <View style={[styles.modalSearchContainer, { backgroundColor: theme.surface, margin: 12 }]}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={[styles.modalSearchInput, { color: theme.text }]}
                placeholder="Search contact..."
                placeholderTextColor={theme.textSecondary}
                value={userSearchQuery}
                onChangeText={handleSearchUsers}
              />
            </View>
            
            <FlatList
              data={filteredUsers}
              renderItem={renderUserItem}
              keyExtractor={item => item._id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No users found</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Create Group Modal - WhatsApp Style */}
      <Modal visible={showCreateGroup} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={() => {
                setShowCreateGroup(false);
                setGroupName('');
                setSelectedUsers([]);
              }}>
                <Text style={[styles.modalCancel, { color: theme.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text }]}>New Group</Text>
              <TouchableOpacity onPress={createGroup}>
                <Text style={[styles.modalNext, { color: selectedUsers.length >= 2 ? theme.primary : theme.textSecondary }]}>
                  Next
                </Text>
              </TouchableOpacity>
            </View>
            
            {!groupName ? (
              <>
                <View style={[styles.modalSearchContainer, { backgroundColor: theme.surface, margin: 12 }]}>
                  <Text style={styles.searchIcon}>🔍</Text>
                  <TextInput
                    style={[styles.modalSearchInput, { color: theme.text }]}
                    placeholder="Search..."
                    placeholderTextColor={theme.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
                
                <FlatList
                  data={filteredUsers}
                  renderItem={renderGroupUserItem}
                  keyExtractor={item => item._id}
                  showsVerticalScrollIndicator={false}
                />
              </>
            ) : (
              <>
                <View style={styles.selectedUsersContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedUsersScroll}>
                    {selectedUsers.map(userId => {
                      const user = users.find(u => u._id === userId);
                      return (
                        <View key={userId} style={styles.selectedUserChip}>
                          <Text style={styles.selectedUserText}>{user?.fullName?.charAt(0)}</Text>
                          <TouchableOpacity onPress={() => toggleUserSelection(userId)}>
                            <Text style={styles.removeUser}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    <TextInput
                      style={[styles.groupNameInput, { color: theme.text }]}
                      placeholder="Group subject"
                      placeholderTextColor={theme.textSecondary}
                      value={groupName}
                      onChangeText={setGroupName}
                      autoFocus
                    />
                  </ScrollView>
                </View>
                
                <Text style={[styles.contactCount, { color: theme.textSecondary }]}>
                  {filteredUsers.length} contacts
                </Text>
                
                <FlatList
                  data={filteredUsers}
                  renderItem={renderGroupUserItem}
                  keyExtractor={item => item._id}
                  showsVerticalScrollIndicator={false}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullScreenChat: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // WhatsApp-style Header
  mainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 16,
  },
  iconText: {
    fontSize: 20,
  },
  // Three-dot Menu
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  menuContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 101,
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {
    fontSize: 16,
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    position: 'relative',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -0.5,
    height: 2,
    width: '50%',
    borderRadius: 1,
  },
  // Search Bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
    marginBottom: 8,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
    color: '#8E8E93',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  chatList: {
    paddingTop: 4,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#25D366',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  onlineBadgeSmall: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#25D366',
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  chatInfo: {
    flex: 1,
  },
  chatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 11,
  },
  lastMessage: {
    fontSize: 13,
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabIcon: {
    fontSize: 24,
    color: '#FFF',
  },
  // Chat Header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: '400',
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 4,
  },
  chatAvatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarTextSmall: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '600',
  },
  chatHeaderStatus: {
    fontSize: 12,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerAction: {
    padding: 8,
  },
  headerActionText: {
    fontSize: 18,
  },
  // Messages
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageContainer: {
    marginBottom: 12,
  },
  sentContainer: {
    alignItems: 'flex-end',
  },
  receivedContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sentBubble: {
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    borderBottomLeftRadius: 4,
  },
  messageSender: {
    fontSize: 11,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
  },
  messageStatus: {
    fontSize: 11,
  },
  readStatus: {
    color: '#34B7F1',
  },
  messageImage: {
    width: 240,
    height: 180,
    borderRadius: 8,
    marginVertical: 4,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  typingText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Input Bar
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
  },
  attachButton: {
    padding: 8,
  },
  attachIcon: {
    fontSize: 22,
    color: '#8E8E93',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  emojiButton: {
    padding: 8,
  },
  emojiIcon: {
    fontSize: 20,
  },
  sendButton: {
    marginLeft: 4,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    fontSize: 12,
    color: '#FFF',
    transform: [{ rotate: '-45deg' }],
  },
  // Modal - WhatsApp Style
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  modalCancel: {
    fontSize: 17,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalNext: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  selectedUsersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedUsersScroll: {
    flexDirection: 'row',
  },
  selectedUserChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  selectedUserText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  removeUser: {
    color: '#FFF',
    fontSize: 12,
    marginLeft: 4,
  },
  groupNameInput: {
    fontSize: 16,
    paddingVertical: 6,
    minWidth: 150,
  },
  contactCount: {
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  userStatus: {
    fontSize: 13,
  },
  checkMarkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
});
