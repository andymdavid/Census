# AI Disruption Self-Assessment Tool

A Typeform-style web application to assess a company's vulnerability to AI disruption.

## Overview

This application helps businesses evaluate their vulnerability to AI disruption through a 12-question assessment based on three key criteria:

- **Load**: How much of your business involves repetitive, standardized processes
- **Language**: How much of your business relies on communication and content creation
- **Labour**: How dependent your business is on human labor and expertise

The assessment provides a score out of 100 points, indicating the level of vulnerability to AI disruption.

## Features

- 12-question Yes/No assessment with modern Typeform-like UI
- Smooth animations and transitions using Framer Motion
- Real-time scoring
- Results screen with vulnerability assessment
- Lead capture form (name, email, company)
- Thank you page with next steps
- Fully responsive design

## Tech Stack

- React.js with TypeScript for the frontend
- Tailwind CSS for styling
- Framer Motion for animations
- React Router for navigation
- React Hook Form for form validation
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
cd Outform
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
Outform/
├── public/                # Static assets
├── src/
│   ├── pages/             # Main application pages
│   │   ├── Welcome.tsx    # Landing page
│   │   ├── Questions.tsx  # Assessment questions
│   │   ├── Results.tsx    # Results and lead capture
│   │   └── ThankYou.tsx   # Thank you page
│   ├── components/        # Reusable UI components
│   ├── data/              # Data files
│   │   └── questions.ts   # Assessment questions
│   ├── styles/            # Styling files
│   │   └── global.css     # Global styles with Tailwind imports
│   ├── utils/             # Utility functions
│   ├── App.tsx            # Main app component with routing
│   └── index.tsx          # Entry point
├── tailwind.config.js     # Tailwind CSS configuration
├── postcss.config.js      # PostCSS configuration
├── package.json           # Project dependencies
└── README.md              # Project documentation
```

## UI Features

- **Typeform-like Design**: Clean, focused interface with one question at a time
- **Animations**: Smooth transitions between questions and pages
- **Responsive Layout**: Works on mobile, tablet, and desktop devices
- **Custom Styling**: Consistent color scheme and typography
- **Progress Indicator**: Visual feedback on assessment progress

## Next Steps

- Implement detailed report generation
- Add analytics to track user engagement
- Create a dashboard for administrators
- Implement user accounts for saving progress
- Deploy to Vercel

## License

This project is licensed under the MIT License.
