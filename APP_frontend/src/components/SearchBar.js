import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Text,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function SearchBar({ onSearch, onCancel }) {
  const { theme } = useTheme();
  const [searchText, setSearchText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const widthAnim = useState(new Animated.Value(40))[0];

  const toggleSearch = () => {
    if (isExpanded) {
      Animated.timing(widthAnim, {
        toValue: 40,
        duration: 300,
        useNativeDriver: false,
      }).start();
      setIsExpanded(false);
      setSearchText('');
      onSearch('');
      onCancel?.();
    } else {
      Animated.timing(widthAnim, {
        toValue: 250,
        duration: 300,
        useNativeDriver: false,
      }).start();
      setIsExpanded(true);
    }
  };

  const handleChangeText = (text) => {
    setSearchText(text);
    onSearch(text);
  };

  return (
    <View style={styles.container}>
      {isExpanded ? (
        <Animated.View style={[styles.searchInputContainer, { width: widthAnim }]}>
          <TextInput
            style={[styles.searchInput, { color: theme.text, backgroundColor: theme.surface }]}
            placeholder="Search chats..."
            placeholderTextColor={theme.textSecondary}
            value={searchText}
            onChangeText={handleChangeText}
            autoFocus
          />
        </Animated.View>
      ) : null}
      <TouchableOpacity onPress={toggleSearch} style={styles.searchButton}>
        <Text style={[styles.searchIcon, { color: theme.primary }]}>🔍</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    overflow: 'hidden',
    marginRight: 12,
  },
  searchInput: {
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    width: 250,
  },
  searchButton: {
    padding: 8,
  },
  searchIcon: {
    fontSize: 20,
  },
});
