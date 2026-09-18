import React from "react";

interface SkeletonLoaderProps {
  count: number;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ count }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card skeleton">
          <div className="skeleton-line" style={{ height: "16px", width: "80%", marginBottom: "16px" }} />
          <div className="skeleton-line" style={{ height: "48px", width: "100%", marginBottom: "8px" }} />
          <div className="skeleton-line" style={{ height: "48px", width: "100%", marginBottom: "8px" }} />
          <div className="skeleton-line" style={{ height: "48px", width: "100%", marginBottom: "8px" }} />
          <div className="skeleton-line" style={{ height: "48px", width: "100%" }} />
        </div>
      ))}
    </>
  );
};
