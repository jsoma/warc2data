import React, { useState, useEffect } from 'react';
import './PathSelector.css';

const PathSelector = ({ path, onPathChange, selectedRequests, suggestedPath, onSuggestedPathSelect }) => {
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState(path);

  // Update input value when path prop changes
  useEffect(() => {
    setInputValue(path);
  }, [path]);

  const validatePath = (pathToValidate) => {
    // Basic validation for JQ path format
    if (!pathToValidate) return true; // Empty path is valid
    
    // Check for invalid characters
    const invalidChars = /[^a-zA-Z0-9_.]/g;
    if (invalidChars.test(pathToValidate)) {
      return false;
    }
    
    // Check for consecutive dots
    if (pathToValidate.includes('..')) {
      return false;
    }
    
    // Check for starting or ending with a dot
    if (pathToValidate.startsWith('.') || pathToValidate.endsWith('.')) {
      return false;
    }
    
    return true;
  };

  const handleInputChange = (e) => {
    const newPath = e.target.value;
    setInputValue(newPath);
    
    // Validate the path
    if (validatePath(newPath)) {
      setError(null);
      onPathChange(newPath); // Update the path immediately if valid
    } else {
      setError('Invalid path format');
      // Still update the input value but don't call onPathChange
    }
  };

  // Format sample data for display
  const formatSample = (sample) => {
    if (!sample || !Array.isArray(sample) || sample.length === 0) {
      return 'No sample available';
    }
    
    try {
      // If the sample items are objects, show the keys
      if (typeof sample[0] === 'object' && sample[0] !== null) {
        const keys = Object.keys(sample[0]).slice(0, 3); // Show up to 3 keys
        return `Keys: ${keys.join(', ')}${keys.length < Object.keys(sample[0]).length ? '...' : ''}`;
      }
      
      // For arrays of primitives, show the values
      const values = sample.map(item => {
        if (typeof item === 'string') {
          return `"${item.length > 15 ? item.substring(0, 15) + '...' : item}"`;
        }
        return String(item);
      }).slice(0, 3);
      
      return `Values: ${values.join(', ')}${sample.length > 3 ? '...' : ''}`;
    } catch (e) {
      return 'Sample preview unavailable';
    }
  };

  return (
    <div className="path-selector">
      <div className="path-input-container">
        <div className="path-input-row">
          <label htmlFor="data-path" className="path-label">Data Path:</label>
          <input
            id="data-path"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Click on a JSON field to select a path"
            className={`path-input ${error ? 'error' : ''}`}
          />
        </div>
        {error && <div className="path-error">{error}</div>}
        
        {suggestedPath && (
          <div className="path-suggestion-container">
            <div className="path-suggestion-header">
              <span className="suggestion-icon">💡</span>
              <span className="suggestion-title">Suggested:</span>
            </div>
            <div className="path-suggestion-content">
              <div className="suggestion-path">{suggestedPath.path}</div>
              <div className="suggestion-description">{suggestedPath.description}</div>
              {suggestedPath.sample && (
                <div className="suggestion-sample">{formatSample(suggestedPath.sample)}</div>
              )}
              <button 
                className="use-suggestion-btn"
                onClick={onSuggestedPathSelect}
              >
                Use
              </button>
            </div>
          </div>
        )}
        
        <div className="path-help">
          <p>Click on a JSON field to select its path, or type manually. Examples: <code>data</code>, <code>data.items</code>, <code>results.0.id</code></p>
        </div>
      </div>
    </div>
  );
};

export default PathSelector; 