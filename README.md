# FedEx Employee Hierarchy Generator

## Tech Stack Overview

### Core Technologies
- **HTML5**: Semantic structure with accessible components
- **CSS3**: Flexbox/Grid layouts, CSS variables, animations
- **JavaScript**: ES6+ features for application logic

### Key Libraries
- **D3.js (v7.8.5)**: Interactive data visualization and hierarchy rendering
- **SheetJS (xlsx 0.18.5)**: Excel/CSV file parsing and processing
- **html2canvas**: Client-side screenshot generation
- **Inter Font**: Modern typography via Google Fonts

### Data Processing
- **Normalization**: Case-insensitive matching with special character handling
- **Fuzzy Matching**: Levenshtein-based name similarity scoring
- **Hierarchy Construction**: Multi-directional tree building (upward/downward)

### Visualization Features
- **Dynamic Org Charts**: Zoomable force-directed layouts
- **Responsive Nodes**: Size-adjusted elements with text wrapping
- **Interactive Elements**: Tooltips, click-to-expand, drag-to-reposition

### Storage
- **LocalStorage**: Persistent dataset and layout storage

### UI Components
- **Modals**: Employee detail views
- **Custom Controls**: Sliders for layout adjustment
- **Export Tools**: PNG generation and clipboard copy

### Deployment
- **Static Site**: No server requirements
- **Cross-Browser**: Chrome/Firefox/Edge support
- **Mobile-Friendly**: Responsive breakpoints

## Installation
No installation required - runs directly in modern browsers. For development:
```bash
git clone [repo-url]
cd fedex-hierarchy
# Open index.html in browser
```
