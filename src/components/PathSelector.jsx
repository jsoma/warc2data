import React, { useState, useEffect, useRef } from 'react';
import './PathSelector.css';

const PathSelector = ({ path, onPathChange, selectedRequests, suggestedPath, onSuggestedPathSelect }) => {
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState(path);
  const [showHelp, setShowHelp] = useState(false);
  const helpPanelRef = useRef(null);

  // Update input value when path prop changes
  useEffect(() => {
    setInputValue(path);
  }, [path]);

  // Close help panel when clicking outside
  useEffect(() => {
    if (!showHelp) return;
    
    const handleClickOutside = (event) => {
      if (helpPanelRef.current && !helpPanelRef.current.contains(event.target) && 
          !event.target.classList.contains('help-button')) {
        setShowHelp(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHelp]);

  const handleInputChange = (e) => {
    const newPath = e.target.value;
    setInputValue(newPath);

    try {
      onPathChange(newPath); // Update the path immediately if valid
      setError(null);
    } catch (e) {
      setError('Invalid path format');
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

  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  return (
    <div className="path-selector">
      <div className="path-input-container">
        <div className="path-input-row">
          <label htmlFor="data-path" className="path-label">JQ Path:</label>
          <input
            id="data-path"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Enter JQ path (e.g., .data.items[0].name)"
            className={`path-input ${error ? 'error' : ''}`}
          />
          <button 
            type="button" 
            className="help-button"
            onClick={toggleHelp}
            title="Show JQ syntax help"
            aria-label="Show JQ syntax help"
          >
            ?
          </button>
        </div>
        {error && <div className="path-error">{error}</div>}
        
        {showHelp && (
          <div className="jq-help-panel" ref={helpPanelRef}>
            <h4>JQ Path Syntax Examples:</h4>
            <ul>
              <li><code>.</code> - The entire JSON object</li>
              <li><code>.property</code> - Access a property</li>
              <li><code>.property.nested</code> - Access a nested property</li>
              <li><code>.array[0]</code> - Access the first element of an array</li>
              <li><code>.array[]</code> - Iterate over all elements in an array</li>
              <li><code>.array[].property</code> - Access a property from each array element</li>
              <li><code>.property | length</code> - Get the length of an array or string</li>
              <li><code>.[] | select(.property == "value")</code> - Filter array elements</li>
            </ul>
            <p>
              <a href="https://stedolan.github.io/jq/manual/" target="_blank" rel="noopener noreferrer">
                Full JQ Documentation
              </a>
            </p>
          </div>
        )}
        
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
      </div>
    </div>
  );
};

export default PathSelector; 