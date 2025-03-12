/**
 * Assessment questions data
 * This file contains the questions for the AI disruption assessment
 */

export interface Question {
  id: number;
  text: string;
  weight: number;
  category: 'Load' | 'Language' | 'Labour';
}

/**
 * Assessment questions
 * Total weight: 100 points
 * Categories: Load (40 points), Language (30 points), Labour (30 points)
 */
const questions: Question[] = [
  // Load category questions (40 points)
  { 
    id: 1, 
    text: "Does your business depend on defined processes that follow a specific sequence of steps?", 
    weight: 14, 
    category: "Load" 
  },
  { 
    id: 2, 
    text: "Are these processes performed the same way each time?", 
    weight: 10, 
    category: "Load" 
  },
  { 
    id: 3, 
    text: "Can these processes be documented as a standard set of steps?", 
    weight: 10, 
    category: "Load" 
  },
  { 
    id: 4, 
    text: "Would your business remain competitive if these processes were automated?", 
    weight: 6, 
    category: "Load" 
  },
  
  // Language category questions (30 points)
  { 
    id: 5, 
    text: "Do you have more than 4 employees focused on language-intensive tasks like writing, editing, translating, or managing audio/text communications?", 
    weight: 8, 
    category: "Language" 
  },
  { 
    id: 6, 
    text: "Can new employees in these roles be fully trained in less than 1 month?", 
    weight: 6, 
    category: "Language" 
  },
  { 
    id: 7, 
    text: "Are these employees paid more than $100,000PA?", 
    weight: 9, 
    category: "Language" 
  },
  { 
    id: 8, 
    text: "Do these language-intensive tasks often follow predictable patterns or templates that could be easily replicated?", 
    weight: 7, 
    category: "Language" 
  },
  
  // Labour category questions (45 points)
  { 
    id: 9, 
    text: "Do employee salaries and wages make up more than 50% of your business expenses?", 
    weight: 10, 
    category: "Labour" 
  },
  { 
    id: 10, 
    text: "Do most of your employees use similar skills to complete their tasks?", 
    weight: 7, 
    category: "Labour" 
  },
  { 
    id: 11, 
    text: "Are these tasks relatively simple and straightforward to complete?", 
    weight: 7, 
    category: "Labour" 
  },
  { 
    id: 12, 
    text: "Can your business handle mistakes in these tasks without significant financial loss or customer impact?", 
    weight: 6, 
    category: "Labour" 
  },
];

export default questions; 