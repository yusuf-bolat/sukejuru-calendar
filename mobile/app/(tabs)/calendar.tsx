import { useState, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native'
import { Calendar } from 'react-native-calendars'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/Colors'

interface Event {
  id: string
  title: string
  start_date: string
  start_time?: string
  end_date?: string
  end_time?: string
  location?: string
  description?: string
}

export default function CalendarScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [events, setEvents] = useState<Event[]>([])
  const [dayEvents, setDayEvents] = useState<Event[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')

  useEffect(() => {
    fetchEvents()
  }, [])

  useEffect(() => {
    const eventsForDay = events.filter(event => 
      event.start_date === selectedDate || 
      (event.end_date && event.start_date <= selectedDate && event.end_date >= selectedDate)
    )
    setDayEvents(eventsForDay)
  }, [selectedDate, events])

  const fetchEvents = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) {
        console.log('No user found')
        return
      }

      console.log('Fetching events for user:', userData.user.id)

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('start_date', { ascending: true })

      if (error) {
        console.error('Error fetching events:', error)
        return
      }

      console.log('Fetched events:', data)
      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  const handleCreateEvent = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title')
      return
    }

    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      const eventData = {
        user_id: userData.user.id,
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        start_date: selectedDate,
        end_date: selectedDate,
        start_time: '09:00:00',
        end_time: '10:00:00',
        created_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('events').insert([eventData])

      if (error) {
        Alert.alert('Error', 'Failed to create event')
        console.error('Error creating event:', error)
        return
      }

      // Reset form and close modal
      resetForm()
      setModalVisible(false)
      fetchEvents()
      Alert.alert('Success', 'Event created successfully!')
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred')
      console.error('Error creating event:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setLocation('')
  }

  const formatTime = (timeString: string) => {
    const time = new Date(`2000-01-01T${timeString}`)
    return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getMarkedDates = () => {
    const marked: any = {}
    
    // Mark selected date
    marked[selectedDate] = {
      selected: true,
      selectedColor: Colors.primary,
    }

    // Mark dates with events
    events.forEach(event => {
      if (event.start_date === selectedDate) return // Don't override selected date
      
      marked[event.start_date] = {
        ...marked[event.start_date],
        marked: true,
        dotColor: Colors.primary,
      }
      
      // Mark multi-day events
      if (event.end_date && event.end_date !== event.start_date) {
        const start = new Date(event.start_date)
        const end = new Date(event.end_date)
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0]
          if (dateStr === selectedDate) continue
          
          marked[dateStr] = {
            ...marked[dateStr],
            marked: true,
            dotColor: Colors.primary,
          }
        }
      }
    })

    return marked
  }

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={getMarkedDates()}
        theme={{
          backgroundColor: Colors.background,
          calendarBackground: Colors.background,
          textSectionTitleColor: Colors.text,
          dayTextColor: Colors.text,
          todayTextColor: Colors.primary,
          selectedDayTextColor: 'white',
          monthTextColor: Colors.text,
          indicatorColor: Colors.primary,
          textDayFontWeight: '300',
          textMonthFontWeight: 'bold',
          textDayHeaderFontWeight: '300',
          textDayFontSize: 16,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 13,
        }}
      />

      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>
          {new Date(selectedDate).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <MaterialCommunityIcons name="plus" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.eventsContainer}>
        {dayEvents.length === 0 ? (
          <Text style={styles.noEventsText}>No events for this day</Text>
        ) : (
          dayEvents.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              {event.start_time && (
                <Text style={styles.eventTime}>
                  {formatTime(event.start_time)}
                  {event.end_time && ` - ${formatTime(event.end_time)}`}
                </Text>
              )}
              {event.location && (
                <Text style={styles.eventLocation}>📍 {event.location}</Text>
              )}
              {event.description && (
                <Text style={styles.eventDescription}>{event.description}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Event</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Event Title"
                placeholderTextColor={Colors.textSecondary}
                value={title}
                onChangeText={setTitle}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description (optional)"
                placeholderTextColor={Colors.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <TextInput
                style={styles.input}
                placeholder="Location (optional)"
                placeholderTextColor={Colors.textSecondary}
                value={location}
                onChangeText={setLocation}
              />

              <TouchableOpacity 
                style={[styles.createButton, loading && styles.buttonDisabled]}
                onPress={handleCreateEvent}
                disabled={loading}
              >
                <Text style={styles.createButtonText}>
                  {loading ? 'Creating...' : 'Create Event'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  addButton: {
    backgroundColor: Colors.primary,
    padding: 8,
    borderRadius: 20,
  },
  eventsContainer: {
    flex: 1,
    padding: 16,
  },
  noEventsText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 16,
    marginTop: 32,
  },
  eventCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalBody: {
    padding: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    fontSize: 16,
    color: Colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dateTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 8,
  },
  dateTimeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dateTimeValue: {
    fontSize: 16,
    color: Colors.text,
  },
  createButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
})
