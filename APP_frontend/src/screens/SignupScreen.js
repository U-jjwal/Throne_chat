import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
  StatusBar, useColorScheme, ScrollView,
} from 'react-native';
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
};

export default function SignupScreen({ navigation }) {
  const scheme = useColorScheme();
  const C = scheme === 'dark' ? DARK : LIGHT;
  const isDark = scheme === 'dark';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  // signup user and navigate to otp
  const handleSignup = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/signup', { fullName, email, password });
      navigation.navigate('VerifyOtp', { email });
    } catch (error) {
      Alert.alert('Signup Failed', error.response?.data?.message || 'Something went wrong');
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

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Text style={[styles.backText, { color: C.accent }]}>‹  Sign In</Text>
        </TouchableOpacity>

        {/* Brand */}
        <View style={styles.brand}>
          <View style={[styles.logoRing, { backgroundColor: C.accentDim, borderColor: C.accent }]}>
            <Text style={styles.logoGlyph}>T</Text>
          </View>
          <Text style={[styles.appName, { color: C.text }]}>Create Account</Text>
          <Text style={[styles.tagline, { color: C.sub }]}>Join Throne_chat today</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>

          {/* Full Name */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.label, { color: C.sub }]}>Full Name</Text>
            <TextInput
              style={inputStyle('name')}
              placeholder="Your full name"
              placeholderTextColor={C.placeholder}
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

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
                placeholder="Min. 6 characters"
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

          {/* Password strength hint */}
          {password.length > 0 && (
            <View style={styles.strengthRow}>
              <View style={[styles.strengthBar, { backgroundColor: password.length >= 6 ? '#34C759' : '#FF3B30' }]} />
              <Text style={[styles.strengthText, { color: password.length >= 6 ? '#34C759' : '#FF3B30' }]}>
                {password.length >= 10 ? 'Strong' : password.length >= 6 ? 'Good' : 'Too short'}
              </Text>
            </View>
          )}

          {/* Continue */}
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: C.accent }, loading && styles.btnDisabled]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.82}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.primaryBtnText}>Continue</Text>
            }
          </TouchableOpacity>

          {/* Terms note */}
          <Text style={[styles.terms, { color: C.placeholder }]}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: C.sub }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
            <Text style={[styles.footerLink, { color: C.accent }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },

  backBtn: { marginBottom: 24 },
  backText: { fontSize: 17, fontWeight: '500' },

  brand: { alignItems: 'center', marginBottom: 36 },
  logoRing: {
    width: 72, height: 72, borderRadius: 22,
    borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  logoGlyph: { fontSize: 32, fontWeight: '800', color: '#5856D6' },
  appName: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginBottom: 6 },
  tagline: { fontSize: 15 },

  card: {
    borderRadius: 20, padding: 24, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },

  fieldWrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, letterSpacing: 0.2 },
  input: {
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 16, borderWidth: 1,
  },
  passWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1 },
  passInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16 },
  eyeBtn: { paddingHorizontal: 14 },
  eyeIcon: { fontSize: 18 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: -10 },
  strengthBar: { width: 36, height: 3, borderRadius: 2, marginRight: 8 },
  strengthText: { fontSize: 12, fontWeight: '500' },

  primaryBtn: {
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    marginTop: 4, shadowColor: '#5856D6',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  terms: { fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 16 },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { fontSize: 14 },
  footerLink: { fontSize: 14, fontWeight: '600' },
});
