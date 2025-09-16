import React from 'react'
import Link from 'next/link'

export default function ForumPage() {
	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100 p-6">
			<div className="max-w-xl text-center">
				<h1 className="text-2xl font-semibold mb-4">Course Forums</h1>
				<p className="text-gray-400 mb-6">This page is a placeholder. Open a course detail and click the forum button to join a course-specific forum.</p>
				<Link href="/courses" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">Browse courses</Link>
			</div>
		</div>
	)
}
