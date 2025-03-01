import React, { useState, useEffect } from 'react';
import './JsonBrowser.css';

const JsonBrowser = ({ jsonFiles, onFileSelect, selectedRequests, onRequestToggle, onBatchRequestToggle, pages = [], selectedPage = 'all', onPageChange, searchTerm = '', onSearchChange, onClearFilters }) => {
  const [sortedFiles, setSortedFiles] = useState([]);
  const [sortBy, setSortBy] = useState('default');
  const [lastClickedIndex, setLastClickedIndex] = useState(null);
  const [selectAll, setSelectAll] = useState(false);
  const [pathSuggestion, setPathSuggestion] = useState(null);

  // Calculate content size in KB
  const getContentSize = (file) => {
    if (!file.content) return 0;
    const contentStr = typeof file.content === 'string' 
      ? file.content 
      : JSON.stringify(file.content);
    return Math.round(contentStr.length / 1024 * 10) / 10; // Size in KB with 1 decimal
  };

  // Format the path for display
  const formatPath = (file) => {
    // If we have a pathname, use it
    if (file.pathname) {
      return file.pathname;
    }
    
    // Otherwise try to extract pathname from the full path
    try {
      if (file.path && file.path.startsWith('http')) {
        return new URL(file.path).pathname;
      }
    } catch (e) {
      // If URL parsing fails, just return the original path
    }
    
    return file.path;
  };

  // Extract domain from URL
  const getDomain = (file) => {
    try {
      if (file.hostname) {
        return file.hostname;
      }
      
      if (file.path && file.path.startsWith('http')) {
        return new URL(file.path).hostname;
      }
    } catch (e) {
      // If URL parsing fails, return empty string
    }
    
    return '';
  };

  // Update sorted files when files or sort method changes
  useEffect(() => {    
    if (!jsonFiles || !Array.isArray(jsonFiles) || jsonFiles.length === 0) {
      setSortedFiles([]);
      return;
    }
    
    // Use a simple array spread which is sufficient for our sorting needs
    let newSortedFiles = [...jsonFiles];
        
    if (sortBy === 'size-desc') {
      newSortedFiles.sort((a, b) => getContentSize(b) - getContentSize(a));
    } else if (sortBy === 'size-asc') {
      newSortedFiles.sort((a, b) => getContentSize(a) - getContentSize(b));
    } else if (sortBy === 'path') {
      newSortedFiles.sort((a, b) => (a.pathname || a.path).localeCompare(b.pathname || b.path));
    } else if (sortBy === 'domain') {
      newSortedFiles.sort((a, b) => getDomain(a).localeCompare(getDomain(b)));
    } else if (sortBy === 'time') {
      newSortedFiles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    console.log("JsonBrowser: Setting sortedFiles with", newSortedFiles.length, "files");
    setSortedFiles(newSortedFiles);
  }, [jsonFiles, sortBy]);

  // Calculate path suggestions based on size
  useEffect(() => {
    if (!jsonFiles || !Array.isArray(jsonFiles) || jsonFiles.length === 0) {
      setPathSuggestion(null);
      return;
    }

    // Group files by path
    const pathGroups = {};
    jsonFiles.forEach(file => {
      const path = formatPath(file);
      if (!pathGroups[path]) {
        pathGroups[path] = {
          path,
          count: 0,
          totalSize: 0,
          files: []
        };
      }
      pathGroups[path].count++;
      pathGroups[path].totalSize += getContentSize(file);
      pathGroups[path].files.push(file);
    });

    // Find the largest group
    let largestGroup = null;
    Object.values(pathGroups).forEach(group => {
      if (!largestGroup || group.totalSize > largestGroup.totalSize) {
        largestGroup = group;
      }
    });

    if (largestGroup) {
      // Format the size for display
      let sizeDisplay;
      if (largestGroup.totalSize >= 1024) {
        sizeDisplay = `${(largestGroup.totalSize / 1024).toFixed(2)} MB`;
      } else {
        sizeDisplay = `${largestGroup.totalSize.toFixed(1)} KB`;
      }

      setPathSuggestion({
        path: largestGroup.path,
        count: largestGroup.count,
        size: sizeDisplay,
        files: largestGroup.files
      });
    }
  }, [jsonFiles]);

  // Update selectAll state when all files are selected or deselected
  useEffect(() => {
    if (!jsonFiles || !Array.isArray(jsonFiles)) {
      setSelectAll(false);
      return;
    }
    
    setSelectAll(selectedRequests.length === jsonFiles.length && jsonFiles.length > 0);
  }, [selectedRequests, jsonFiles]);

  // Handle checkbox click with shift key for multi-select
  const handleCheckboxClick = (file, isChecked, index, event) => {
    if (event.shiftKey && lastClickedIndex !== null && index !== lastClickedIndex) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      
      // Get the range of files to toggle
      const filesToToggle = sortedFiles.slice(start + 1, end);
      
      // Add the current file to the list
      filesToToggle.push(file);
      
      // Use batch toggle for better performance
      onBatchRequestToggle(filesToToggle, isChecked);
    } else {
      // Single file toggle
      onRequestToggle(file, isChecked);
    }
    
    setLastClickedIndex(index);
  };

  // Handle select all toggle
  const handleSelectAll = (isChecked) => {
    setSelectAll(isChecked);
    
    // Use batch toggle for all files
    onBatchRequestToggle(sortedFiles, isChecked);
    
    // If selecting all and there are files, also select the first one for display
    if (isChecked && sortedFiles.length > 0) {
      onFileSelect(sortedFiles[0]);
    }
  };

  // Change sort method
  const handleSortChange = (newSortBy) => {
    setSortBy(newSortBy);
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return timestamp;
    }
  };

  // Handle suggestion click to select all files in the suggested path
  const handleSuggestionClick = () => {
    if (pathSuggestion) {
      // Select all files in the suggested path
      onBatchRequestToggle(pathSuggestion.files, true);
      
      // Set the filter to the suggested path
      if (onSearchChange) {
        const event = { target: { value: pathSuggestion.path } };
        onSearchChange(event);
      }
    }
  };

  return (
    <div className="json-browser">
      <div className="browser-header">
        <div className="header-title">
          <h2>API Requests {selectedRequests.length > 0 && <span className="selected-count-badge">({selectedRequests.length})</span>}</h2>
        </div>
        
        <div className="controls-row">
          <div className="filter-controls">
            <input
              type="text"
              value={searchTerm}
              onChange={onSearchChange}
              placeholder="Filter by path..."
              className="search-input"
            />
            
            {searchTerm && (
              <button 
                className="clear-filters-button" 
                onClick={onClearFilters}
              >
                Clear
              </button>
            )}
          </div>
          
          <div className="sort-controls">
            <label htmlFor="sort-select">Sort by:</label>
            <select 
              id="sort-select" 
              value={sortBy} 
              onChange={(e) => handleSortChange(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="size-desc">Size (Largest)</option>
              <option value="size-asc">Size (Smallest)</option>
              <option value="path">Path</option>
              <option value="domain">Domain</option>
              <option value="time">Time</option>
            </select>
          </div>
        </div>
      </div>
      
      {pathSuggestion && (
        <div className="path-suggestion" onClick={handleSuggestionClick}>
          <div className="suggestion-content">
            <span className="suggestion-icon">💡</span>
            <span className="suggestion-text">
              Largest group: <strong>{pathSuggestion.path}</strong> ({pathSuggestion.count} requests, {pathSuggestion.size})
            </span>
            <button className="select-group-btn">Select</button>
          </div>
        </div>
      )}
      
      <div className="file-list">
        <div className="select-all-button-container">
          <button 
            className={`select-all-button ${selectAll ? 'selected' : ''}`}
            onClick={() => handleSelectAll(!selectAll)}
          >
            {selectAll ? 'Deselect all' : 'Select visible'}
          </button>
        </div>
        
        {sortedFiles.length === 0 ? (
          <p className="empty-message">No API requests found. Upload a WARC/WACZ file to begin.</p>
        ) : (
          <div className="flat-list">
            {sortedFiles.map((file, index) => (
              <div 
                key={file.id} 
                className="file-item"
                onClick={(e) => {
                  // Toggle selection when clicking anywhere in the row
                  const isCurrentlySelected = selectedRequests.some(req => req.id === file.id);
                  handleCheckboxClick(file, !isCurrentlySelected, index, e);
                }}
              >
                <div className="file-header">
                  <input
                    type="checkbox"
                    checked={selectedRequests.some(req => req.id === file.id)}
                    onChange={(e) => {
                      e.stopPropagation(); // Prevent double triggering
                      handleCheckboxClick(file, e.target.checked, index, e);
                    }}
                    onClick={(e) => e.stopPropagation()} // Prevent row click when clicking checkbox
                  />
                  <div 
                    className="file-info"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent selection toggle
                      onFileSelect(file);
                    }}
                  >
                    <div className="file-path" title={file.path}>
                      {formatPath(file)}
                    </div>
                  </div>
                  <div className="file-metadata">
                    <span className="file-domain">{getDomain(file)}</span>
                    <span className="content-size">{getContentSize(file)} KB</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default JsonBrowser; 