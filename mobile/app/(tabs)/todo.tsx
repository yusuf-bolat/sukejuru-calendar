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
  Platform,
} from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { supabase } from '../../lib/supabase'
import { Colors } from '../../constants/Colors'

interface Todo {
  id: string
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
  due_date?: string
  due_time?: string
  created_at: string
}

export default function TodoScreen() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending')
  
  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')

  useEffect(() => {
    fetchTodos()
  }, [])

  const fetchTodos = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      const { data, error } = await supabase
        .from('assignments')
        .select('*')
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching todos:', error)
        return
      }

      setTodos(data || [])
    } catch (error) {
      console.error('Error fetching todos:', error)
    }
  }

  const handleCreateTodo = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title')
      return
    }

    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData?.user) return

      const todoData = {
        user_id: userData.user.id,
        title: title.trim(),
        description: description.trim() || null,
        priority: priority,
        completed: false,
        due_date: new Date().toISOString().split('T')[0],
        due_time: '23:59:00',
        created_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('assignments').insert([todoData])

      if (error) {
        Alert.alert('Error', 'Failed to create task')
        console.error('Error creating todo:', error)
        return
      }

      // Reset form and close modal
      resetForm()
      setModalVisible(false)
      fetchTodos()
      Alert.alert('Success', 'Task created successfully!')
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred')
      console.error('Error creating todo:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleTodoStatus = async (todo: Todo) => {
    try {
      const { error } = await supabase
        .from('assignments')
        .update({ completed: !todo.completed })
        .eq('id', todo.id)

      if (error) {
        Alert.alert('Error', 'Failed to update task')
        console.error('Error updating todo:', error)
        return
      }

      fetchTodos()
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred')
      console.error('Error updating todo:', error)
    }
  }

  const deleteTodo = async (todoId: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('assignments')
                .delete()
                .eq('id', todoId)

              if (error) {
                Alert.alert('Error', 'Failed to delete task')
                console.error('Error deleting todo:', error)
                return
              }

              fetchTodos()
            } catch (error) {
              Alert.alert('Error', 'An unexpected error occurred')
              console.error('Error deleting todo:', error)
            }
          },
        },
      ]
    )
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setPriority('medium')
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return '#ff4757'
      case 'medium':
        return '#ffa502'
      case 'low':
        return '#2ed573'
      default:
        return Colors.textSecondary
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'chevron-double-up'
      case 'medium':
        return 'chevron-up'
      case 'low':
        return 'chevron-down'
      default:
        return 'minus'
    }
  }

  const filteredTodos = todos.filter(todo => {
    switch (filter) {
      case 'completed':
        return todo.completed
      case 'pending':
        return !todo.completed
      default:
        return true
    }
  })

  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity
        style={[
          styles.filterButton,
          filter === 'pending' && styles.filterButtonActive
        ]}
        onPress={() => setFilter('pending')}
      >
        <Text style={[
          styles.filterText,
          filter === 'pending' && styles.filterTextActive
        ]}>
          Pending ({todos.filter(t => !t.completed).length})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.filterButton,
          filter === 'completed' && styles.filterButtonActive
        ]}
        onPress={() => setFilter('completed')}
      >
        <Text style={[
          styles.filterText,
          filter === 'completed' && styles.filterTextActive
        ]}>
          Completed ({todos.filter(t => t.completed).length})
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.filterButton,
          filter === 'all' && styles.filterButtonActive
        ]}
        onPress={() => setFilter('all')}
      >
        <Text style={[
          styles.filterText,
          filter === 'all' && styles.filterTextActive
        ]}>
          All ({todos.length})
        </Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      {renderFilterButtons()}

      <ScrollView style={styles.todosContainer}>
        {filteredTodos.length === 0 ? (
          <Text style={styles.noTodosText}>
            {filter === 'completed' ? 'No completed tasks' : 
             filter === 'pending' ? 'No pending tasks' : 'No tasks yet'}
          </Text>
        ) : (
          filteredTodos.map((todo) => (
            <View key={todo.id} style={styles.todoCard}>
              <View style={styles.todoHeader}>
                <View style={styles.todoTitleSection}>
                  <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => toggleTodoStatus(todo)}
                  >
                    <MaterialCommunityIcons
                      name={todo.completed ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={24}
                      color={todo.completed ? Colors.primary : Colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <Text style={[
                    styles.todoTitle,
                    todo.completed && styles.todoTitleCompleted
                  ]}>
                    {todo.title}
                  </Text>
                </View>

                <View style={styles.todoActions}>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(todo.priority) }]}>
                    <MaterialCommunityIcons
                      name={getPriorityIcon(todo.priority)}
                      size={16}
                      color="white"
                    />
                    <Text style={styles.priorityText}>{todo.priority.toUpperCase()}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteTodo(todo.id)}
                  >
                    <MaterialCommunityIcons name="delete" size={20} color="#ff4757" />
                  </TouchableOpacity>
                </View>
              </View>

              {todo.description && (
                <Text style={[
                  styles.todoDescription,
                  todo.completed && styles.todoDescriptionCompleted
                ]}>
                  {todo.description}
                </Text>
              )}

              {todo.due_date && (
                <Text style={styles.dueDate}>
                  📅 Due: {new Date(todo.due_date).toLocaleDateString()}
                  {todo.due_time && ` at ${new Date(`2000-01-01T${todo.due_time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <MaterialCommunityIcons name="plus" size={24} color="white" />
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Task</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TextInput
                style={styles.input}
                placeholder="Task Title"
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

              <Text style={styles.sectionTitle}>Priority</Text>
              <View style={styles.priorityContainer}>
                {(['high', 'medium', 'low'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityOption,
                      priority === p && { backgroundColor: getPriorityColor(p) }
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <MaterialCommunityIcons
                      name={getPriorityIcon(p)}
                      size={20}
                      color={priority === p ? 'white' : getPriorityColor(p)}
                    />
                    <Text style={[
                      styles.priorityOptionText,
                      priority === p && styles.priorityOptionTextActive
                    ]}>
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={[styles.createButton, loading && styles.buttonDisabled]}
                onPress={handleCreateTodo}
                disabled={loading}
              >
                <Text style={styles.createButtonText}>
                  {loading ? 'Creating...' : 'Create Task'}
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  filterTextActive: {
    color: 'white',
  },
  todosContainer: {
    flex: 1,
    padding: 16,
  },
  noTodosText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 16,
    marginTop: 32,
  },
  todoCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  todoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  todoTitleSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxContainer: {
    marginRight: 12,
  },
  todoTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  todoTitleCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
  },
  todoActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  priorityText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  deleteButton: {
    padding: 4,
  },
  todoDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 36,
  },
  todoDescriptionCompleted: {
    textDecorationLine: 'line-through',
  },
  dueDate: {
    fontSize: 12,
    color: Colors.primary,
    marginLeft: 36,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  priorityContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  priorityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  priorityOptionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text,
  },
  priorityOptionTextActive: {
    color: 'white',
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
