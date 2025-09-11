// AI Advisor functionality has been integrated into the main ChatPanel
// This page is no longer used - all course counseling happens in the chat interface

export default function AIAdvisorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center">
      <div className="text-center text-white">
        <h1 className="text-2xl font-bold mb-4">AI Advisor Integrated</h1>
        <p className="mb-4">AI course counseling is now available directly in the chat interface on the main dashboard.</p>
        <a href="/" className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg transition-colors">
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}