import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const themes = {
  light: {
    background: '#FFFFFF',
    surface: '#F2F2F7',
    primary: '#007AFF',
    text: '#000000',
    textSecondary: '#8E8E93',
    border: '#C6C6C8',
    sentBubble: '#007AFF',
    receivedBubble: '#E5E5EA',
    sentText: '#FFFFFF',
    receivedText: '#000000',
    headerBackground: '#FFFFFF',
    statusBar: 'dark',
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    primary: '#0A84FF',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    sentBubble: '#0A84FF',
    receivedBubble: '#1C1C1E',
    sentText: '#FFFFFF',
    receivedText: '#FFFFFF',
    headerBackground: '#000000',
    statusBar: 'light',
  },
};

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [theme, setTheme] = useState(themes.light);

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    setTheme(isDarkMode ? themes.dark : themes.light);
    AsyncStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const loadTheme = async () => {
    const savedTheme = await AsyncStorage.getItem('theme');
    setIsDarkMode(savedTheme === 'dark');
  };

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
