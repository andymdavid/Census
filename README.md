# AI Disruption Self-Assessment Tool

A Typeform-style web application to assess a company's vulnerability to AI disruption.

## Overview

This application helps businesses evaluate their vulnerability to AI disruption through a 12-question assessment based on three key criteria:

- **Load**: How much of your business involves repetitive, standardized processes
- **Language**: How much of your business relies on communication and content creation
- **Labour**: How dependent your business is on human labor and expertise

The assessment provides a score out of 115 points, indicating the level of vulnerability to AI disruption.

## Features

- 12-question Yes/No assessment
- Real-time scoring
- Results screen with vulnerability assessment
- Lead capture form (name, email, company)
- Thank you page with next steps

## Tech Stack

- React.js with TypeScript for the frontend
- Tailwind CSS for styling
- Node.js with Express for the backend (coming soon)
- Deployment on Vercel (coming soon)

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository
```
git clone <repository-url>
cd ai-assessment
```

2. Install dependencies
```
npm install
```

3. Start the development server
```
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
ai-assessment/
├── public/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── Welcome.tsx   # Landing page
│   │   ├── Questions.tsx # Assessment questions
│   │   ├── Results.tsx   # Results and lead capture
│   │   └── ThankYou.tsx  # Thank you page
│   ├── data/             # Data files
│   │   └── questions.ts  # Assessment questions
│   ├── utils/            # Utility functions
│   ├── App.tsx           # Main app component
│   └── index.tsx         # Entry point
├── package.json
└── README.md
```

## Next Steps

- Implement routing between pages
- Add state management for assessment data
- Create backend API for storing user data
- Implement detailed report generation
- Deploy to Vercel

## License

This project is licensed under the MIT License.
