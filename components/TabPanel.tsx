import { useState, ReactNode } from 'react'
import { ChatPanel } from './ChatPanel'
import { TodoPanel } from './TodoPanel'

interface TabPanelProps {
  view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
  currentDate: Date
  selectedDate?: Date
}

export function TabPanel({ view, currentDate, selectedDate }: TabPanelProps) {
  const [activeTab, setActiveTab] = useState<'ai-assistant' | 'todo-list'>('ai-assistant')

  return (
    <div className="tab-panel-container">
      <div className="tab-header">
        <button
          className={`tab-button ${activeTab === 'ai-assistant' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai-assistant')}
        >
          <span className="tab-icon">🤖</span>
          <span className="tab-label">AI Assistant</span>
        </button>

        <button
          className={`tab-button ${activeTab === 'todo-list' ? 'active' : ''}`}
          onClick={() => setActiveTab('todo-list')}
        >
          <span className="tab-icon">📝</span>
          <span className="tab-label">Todo List</span>
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'ai-assistant' && <ChatPanel />}
        {activeTab === 'todo-list' && (
          // Force sidebar mode when rendering in the calendar sidebar
          <TodoPanel view={view} currentDate={currentDate} selectedDate={selectedDate} forSidebar={true} />
        )}
      </div>
    </div>
  )
}
