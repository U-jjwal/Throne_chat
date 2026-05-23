import React, { useState, useEffect, useCallback } from 'react';
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
  StatusBar,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../services/socket';
import api from '../services/api';

export default function ChatListScreen({ navigation }) {
  const [socket, setSocket] = useState(null);
  const [chats, setChats] = useState([]);
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUsers, setShowUsers] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchChats(), fetchUsers()]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => socketService.disconnect();
  }, []);

  // load user data and connect socket
  const loadData = async () => {
    const userStr = await AsyncStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setCurrentUser(user);
    }

    await fetchChats();
    await fetchUsers();
    await initSocket();
    setLoading(false);
  };

  // connect to socket and listen for events
  const initSocket = async () => {
    const newSocket = await socketService.connect();
    if (!newSocket) return;
    setSocket(newSocket);

    newSocket.on('online_users', (users) => {
      setOnlineUsers(users);
    });

    // update chat list when new message arrives
    newSocket.on('receive_message', (message) => {
      setChats((prev) => {
        const updated = prev.map((chat) => {
          if (chat._id === message.chatId) {
            return { ...chat, latestMessage: message };
          }
          return chat;
        });
        return updated.sort((a, b) => {
          const aTime = a.latestMessage?.createdAt || a.updatedAt;
          const bTime = b.latestMessage?.createdAt || b.updatedAt;
          return new Date(bTime) - new Date(aTime);
        });
      });
    });
  };

  // fetch all user chats
  const fetchChats = async () => {
    try {
      const response = await api.get('/chats');
      setChats(response.data.chats);
    } catch (error) {
      console.error('Failed to fetch chats:', error.message);
    }
  };

  // fetch all users
  const fetchUsers = async () => {
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch users:', error.message);
    }
  };

  // start or open existing chat with a user
  const createOrGetChat = async (userId) => {
    try {
      const response = await api.get(`/chats/user/${userId}`);
      const chat = response.data.chat;

      // add to chat list if not there
      setChats((prev) => {
        if (!prev.find((c) => c._id === chat._id)) {
          return [chat, ...prev];
        }
        return prev;
      });

      setShowUsers(false);
      navigation.navigate('Chat', { chat, currentUser });
    } catch (error) {
      Alert.alert('Error', 'Failed to start chat');
    }
  };

  // create new group chat
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter group name');
      return;
    }
    if (selectedUsers.length < 2) {
      Alert.alert('Error', 'Select at least 2 members');
      return;
    }

    setCreatingGroup(true);
    try {
      const response = await api.post('/chats/group', {
        groupName: groupName.trim(),
        participants: selectedUsers,
      });

      setChats((prev) => [response.data.chat, ...prev]);
      setShowCreateGroup(false);
      setGroupName('');
      setSelectedUsers([]);
      Alert.alert('Success', 'Group created!');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  };

  // toggle user selection for group
  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // logout user
  const handleLogout = async () => {
    // Fire and forget server-side logout so the local session clears instantly even on server hang
    api.post('/auth/logout').catch((err) => console.error('Logout error:', err.message));

    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    socketService.disconnect();
    navigation.replace('Login');
  };

  const isUserOnline = (userId) => onlineUsers.includes(userId);

  // get chat display name
  const getChatName = (chat) => {
    if (chat.isGroupChat) return chat.groupName;
    const other = chat.participants?.find((p) => p._id !== currentUser?._id);
    return other?.fullName || 'Unknown';
  };

  const otherUsers = users.filter((u) => u._id !== currentUser?._id);

  // render single chat item
  const renderChat = ({ item }) => {
    const otherParticipant = item.participants?.find((p) => p._id !== currentUser?._id);
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('Chat', { chat: item, currentUser })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.isGroupChat ? '👥' : getChatName(item).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatRow}>
            <Text style={styles.chatName} numberOfLines={1}>{getChatName(item)}</Text>
            {!item.isGroupChat && isUserOnline(otherParticipant?._id) && (
              <View style={styles.onlineDot} />
            )}
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.latestMessage?.text?.slice(0, 40) || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // render user for selection
  const renderUser = ({ item }) => (
    <TouchableOpacity
      style={[styles.userItem, showCreateGroup && selectedUsers.includes(item._id) && styles.userSelected]}
      onPress={() => (showCreateGroup ? toggleUserSelection(item._id) : createOrGetChat(item._id))}
    >
      <View style={styles.userAvatar}>
        <Text style={styles.avatarText}>{item.fullName?.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.fullName}</Text>
        {!showCreateGroup && (
          <Text style={[styles.userStatus, isUserOnline(item._id) && styles.onlineText]}>
            {isUserOnline(item._id) ? 'Online' : 'Offline'}
          </Text>
        )}
      </View>
      {showCreateGroup && selectedUsers.includes(item._id) && (
        <Text style={styles.checkMark}>✓</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#667eea" />

      {/* header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>👑 Chats</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={() => { setShowCreateGroup(true); setShowUsers(false); }} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>👥+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setShowUsers(true); setShowCreateGroup(false); }} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* new chat user list modal */}
      <Modal visible={showUsers} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Chat</Text>
              <TouchableOpacity onPress={() => setShowUsers(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={otherUsers}
              renderItem={renderUser}
              keyExtractor={(item) => item._id}
            />
          </View>
        </View>
      </Modal>

      {/* create group modal */}
      <Modal visible={showCreateGroup} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Group</Text>
              <TouchableOpacity onPress={() => { setShowCreateGroup(false); setSelectedUsers([]); setGroupName(''); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.groupNameSection}>
                <Text style={styles.groupNameLabel}>Group Name</Text>
                <TextInput
                  style={styles.groupInput}
                  placeholder="Enter group name..."
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholderTextColor="#999"
                  autoFocus={true}
                  returnKeyType="done"
                />
              </View>

              <Text style={styles.sectionLabel}>
                Select Members (min 2) — {selectedUsers.length} selected
              </Text>

              {otherUsers.map((item) => (
                <TouchableOpacity
                  key={item._id}
                  style={[styles.userItem, selectedUsers.includes(item._id) && styles.userSelected]}
                  onPress={() => toggleUserSelection(item._id)}
                >
                  <View style={styles.userAvatar}>
                    <Text style={styles.avatarText}>{item.fullName?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.fullName}</Text>
                  </View>
                  {selectedUsers.includes(item._id) && (
                    <Text style={styles.checkMark}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.createBtn, creatingGroup && { opacity: 0.6 }]}
              onPress={handleCreateGroup}
              disabled={creatingGroup}
            >
              <Text style={styles.createBtnText}>
                {creatingGroup ? 'Creating...' : `Create Group${groupName.trim() ? ` "${groupName.trim()}"` : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <FlatList
        data={chats}
        renderItem={renderChat}
        keyExtractor={(item) => item._id}
        contentContainerStyle={chats.length === 0 && styles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#667eea']}
            tintColor="#667eea"
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>No chats yet</Text>
            <Text style={styles.emptySubtext}>Tap ✏️ to start messaging</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fb',
  },
  header: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerBtn: {
    padding: 6,
  },
  headerBtnText: {
    fontSize: 20,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4caf50',
  },
  lastMessage: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalClose: {
    fontSize: 22,
    color: '#999',
    padding: 4,
  },
  groupNameSection: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: '#f8f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  groupNameLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupInput: {
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#667eea',
    borderRadius: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#888',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  createBtn: {
    backgroundColor: '#667eea',
    margin: 16,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  userSelected: {
    backgroundColor: '#e8eaf6',
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#764ba2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  userStatus: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  onlineText: {
    color: '#4caf50',
  },
  checkMark: {
    fontSize: 20,
    color: '#4caf50',
    fontWeight: 'bold',
  },
});
