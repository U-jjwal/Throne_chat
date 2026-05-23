import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  StatusBar, useColorScheme,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const LIGHT = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  accent: '#5856D6',
  accentDim: 'rgba(88,86,214,0.12)',
  text: '#1C1C1E',
  sub: '#6C6C70',
  placeholder: '#AEAEB2',
  border: 'rgba(0,0,0,0.08)',
  inputBg: '#F2F2F7',
  shadow: 'rgba(0,0,0,0.10)',
};
const DARK = {
  bg: '#000000',
  card: '#1C1C1E',
  accent: '#6362E8',
  accentDim: 'rgba(99,98,232,0.20)',
  text: '#FFFFFF',
  sub: '#8E8E93',
  placeholder: '#636366',
  border: 'rgba(255,255,255,0.08)',
  inputBg: '#2C2C2E',
  shadow: 'rgba(0,0,0,0.40)',
};

export default function LoginScreen({ navigation }) {
  const scheme = useColorScheme();
  const C = scheme === 'dark' ? DARK : LIGHT;
  const isDark = scheme === 'dark';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // login user
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      await AsyncStorage.setItem('token', response.data.token);
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
      navigation.replace('Chat');
    } catch (error) {
      Alert.alert('Login Failed', error.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => [
    styles.input,
    {
      backgroundColor: C.inputBg,
      color: C.text,
      borderColor: focusedField === field ? C.accent : C.border,
      borderWidth: focusedField === field ? 1.5 : 1,
    },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: C.bg }]}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.inner}>
        {/* Brand */}
        <View style={styles.brand}>
          <View style={[styles.logoRing, { backgroundColor: C.accentDim, borderColor: C.accent }]}>
            <Text style={styles.logoGlyph}>T</Text>
          </View>
          <Text style={[styles.appName, { color: C.text }]}>Throne_chat</Text>
          <Text style={[styles.tagline, { color: C.sub }]}>Sign in to continue</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, {
          backgroundColor: C.card,
          shadowColor: C.shadow,
          borderColor: C.border,
        }]}>
          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: C.sub }]}>Email</Text>
            <TextInput
              style={inputStyle('email')}
              placeholder="you@example.com"
              placeholderTextColor={C.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: C.sub }]}>Password</Text>
            <View style={[
              styles.passWrap,
              {
                backgroundColor: C.inputBg,
                borderColor: focusedField === 'password' ? C.accent : C.border,
                borderWidth: focusedField === 'password' ? 1.5 : 1,
              },
            ]}>
              <TextInput
                style={[styles.passInput, { color: C.text }]}
                placeholder="••••••••"
                placeholderTextColor={C.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Text style={[styles.eyeIcon, { color: C.sub }]}>{showPass ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: C.accent }, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.primaryBtnText}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: C.sub }]}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Signup')} activeOpacity={0.7}>
            <Text style={[styles.footerLink, { color: C.accent }]}>Create one</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24 },

  brand: { alignItems: 'center', marginBottom: 40 },
  logoRing: {
    width: 72, height: 72, borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  logoGlyph: { fontSize: 32, fontWeight: '800', color: '#5856D6' },
  appName: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 15, fontWeight: '400' },

  card: {
    borderRadius: 20, padding: 24, borderWidth: 1,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 6,
  },

  fieldWrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.2 },
  input: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, borderWidth: 1,
  },
  passWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: 1,
  },
  passInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  eyeBtn: { paddingHorizontal: 14 },
  eyeIcon: { fontSize: 18 },

  primaryBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    marginTop: 8, shadowColor: '#5856D6',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '600' },
});
