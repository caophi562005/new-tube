import { useEffect, useRef, useState } from "react";

/**
 * Custom hook để theo dõi xem một phần tử có hiển thị trong viewport hay không.
 * Thường dùng cho chức năng Infinite Scroll hoặc Lazy Load.
 */
export const useIntersectionObserver = (options?: IntersectionObserverInit) => {
  const [isIntersection, setIsIntersection] = useState(false);
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      // Cập nhật state khi trạng thái hiển thị thay đổi
      setIsIntersection(entry.isIntersecting);
    }, options);

    if (targetRef.current) {
      observer.observe(targetRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [options]);

  return {
    targetRef, // Ref cần gắn vào phần tử DOM muốn theo dõi
    isIntersection, // Trạng thái: true nếu đang hiển thị, false nếu không
  };
};
