# Sukejuru Calendar 📅

A modern, AI-powered calendar application with Supabase backend integration.

## Live Demo

🚀 **Deploy to Vercel**: [sukejuru.vercel.app](https://sukejuru.vercel.app)

## Features

✨ **Full Calendar Interface** - FullCalendar v6.1.11 with drag & drop
🤖 **AI Chatbot** - Natural language event creation with GPT-4o-mini
🔐 **Authentication** - Secure user registration and login with Supabase
📊 **Database** - PostgreSQL with Row Level Security
🎨 **Responsive Design** - Works on desktop and mobile
⚡ **Real-time Updates** - Live synchronization across devices

## Quick Deploy to Vercel

1. **Fork this repository** on GitHub
2. **Go to [vercel.com](https://vercel.com)** and sign in with GitHub
3. **Click "New Project"** and import your forked repository
4. **Set Environment Variables**:
   - `OPENAI_API_KEY` = Your OpenAI API key
5. **Deploy!** 🚀

## Environment Variables

Add these to your Vercel deployment:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/yusuf-bolat/sukejuru-calendar.git
cd sukejuru-calendar
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Open `public/index.html` in your browser or serve locally:
```bash
# Using Python
python -m http.server 3000

# Using Node.js
npx serve public
```

## Configuration

### Supabase Setup
1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL from `database-schema.sql` in your Supabase SQL editor
3. Update the Supabase URL and key in `public/supabase-auth.js`

### OpenAI Setup
1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Add it to your environment variables

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (ES6+)
- **Calendar**: FullCalendar v6.1.11
- **Backend**: Supabase (PostgreSQL + Auth)
- **AI**: OpenAI GPT-4o-mini
- **Hosting**: Vercel
- **Version Control**: GitHub

## License

MIT License - feel free to use this for your own projects!

## Support

Having issues? Check out:
- [Setup Instructions](SETUP-INSTRUCTIONS.md)
- [Database Schema](database-schema.sql)
- [Environment Example](.env.example)