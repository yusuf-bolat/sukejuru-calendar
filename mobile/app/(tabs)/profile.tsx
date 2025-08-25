import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/Colors'

interface Profile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  full_name?: string
  updated_at: string
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      if (data) {
        setProfile(data)
        setFirstName(data.first_name || '')
        setLastName(data.last_name || '')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Please enter both first and last name')
      return
    }

    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userData.user.id)

      if (error) {
        Alert.alert('Error', 'Failed to update profile')
        console.error('Error updating profile:', error)
        return
      }

      setEditing(false)
      fetchProfile()
      Alert.alert('Success', 'Profile updated successfully!')
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred')
      console.error('Error updating profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut()
              if (error) {
                Alert.alert('Error', 'Failed to sign out')
                console.error('Error signing out:', error)
                return
              }
              router.replace('/(auth)/login')
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred')
              console.error('Error signing out:', error)
            }
          },
        },
      ]
    )
  }

  const getStats = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return { events: 0, todos: 0, completed: 0 }

      const { data: events } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', userData.user.id)

      const { data: todos } = await supabase
        .from('assignments')
        .select('id, completed')
        .eq('user_id', userData.user.id)

      const completed = todos?.filter(todo => todo.completed).length || 0

      return {
        events: events?.length || 0,
        todos: todos?.length || 0,
        completed,
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      return { events: 0, todos: 0, completed: 0 }
    }
  }

  const [stats, setStats] = useState({ events: 0, todos: 0, completed: 0 })

  useEffect(() => {
    getStats().then(setStats)
  }, [])

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <MaterialCommunityIcons name="account-circle" size={80} color={Colors.primary} />
        </View>
        <Text style={styles.displayName}>
          {profile?.full_name || 'User'}
        </Text>
        <Text style={styles.email}>{profile?.email}</Text>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="calendar" size={32} color={Colors.primary} />
          <Text style={styles.statNumber}>{stats.events}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="check-circle" size={32} color={Colors.primary} />
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="clipboard-list" size={32} color={Colors.primary} />
          <Text style={styles.statNumber}>{stats.todos}</Text>
          <Text style={styles.statLabel}>Total Tasks</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditing(!editing)}
          >
            <MaterialCommunityIcons 
              name={editing ? "close" : "pencil"} 
              size={20} 
              color={Colors.primary} 
            />
          </TouchableOpacity>
        </View>

        {editing ? (
          <View style={styles.editForm}>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              placeholderTextColor={Colors.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor={Colors.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleUpdateProfile}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.profileInfo}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account" size={20} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>First Name</Text>
              <Text style={styles.infoValue}>{profile?.first_name || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account" size={20} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>Last Name</Text>
              <Text style={styles.infoValue}>{profile?.last_name || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="email" size={20} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{profile?.email}</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Information</Text>
        <View style={styles.appInfo}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="information" size={20} color={Colors.textSecondary} />
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar-check" size={20} color={Colors.textSecondary} />
            <Text style={styles.infoLabel}>App</Text>
            <Text style={styles.infoValue}>Sukejuru Mobile</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <MaterialCommunityIcons name="logout" size={20} color="white" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Your Academic Calendar & Todo Assistant
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  editButton: {
    padding: 4,
  },
  editForm: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 8,
    fontSize: 16,
    color: Colors.text,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileInfo: {
    gap: 16,
  },
  appInfo: {
    gap: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff4757',
    marginHorizontal: 20,
    marginVertical: 20,
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
})
