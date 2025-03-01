import React, { useState } from 'react';
import './DebugLog.css';

const DebugLog = ({ logs }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!logs || logs.length === 0) {
    return null;
  }

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Group logs by page
  const pageGroups = {};
  logs.forEach(log => {
    if (!pageGroups[log.pageUrl]) {
      pageGroups[log.pageUrl] = {
        page: log.pageUrl,
        requests: []
      };
    }
    pageGroups[log.pageUrl].requests.push(log);
  });

  return (
    <div className="debug-log">
      <div className="debug-log-header" onClick={toggleExpand}>
        <h3>Debug Log <span className="log-count">({logs.length} requests found)</span></h3>
        <button className="toggle-button">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="debug-log-content">
          {Object.values(pageGroups).map((group, index) => (
            <div key={index} className="page-group">
              <h4 className="page-url">{group.page}</h4>
              <div className="request-list">
                {group.requests.map((log, reqIndex) => (
                  <div key={reqIndex} className={`request-item ${log.isJson ? 'json-request' : ''}`}>
                    <div className="request-url">{log.url}</div>
                    <div className="request-details">
                      <span className="request-method">{log.method || 'GET'}</span>
                      <span className="request-status">{log.status || '200'}</span>
                      <span className="content-type">{log.contentType || 'unknown'}</span>
                      {log.isJson && <span className="json-badge">JSON</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DebugLog; 