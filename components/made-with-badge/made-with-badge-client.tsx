"use client";

/**
 * DO NOT MODIFY OR DELETE THIS FILE
 */

import React from "react";
import { X } from "lucide-react";

import { useEffect, useRef } from "react";

export function BadgeProtection() {
  const observerRef = useRef<MutationObserver | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const badgeId = "BADGE_ID_PLACEHOLDER";
  const containerId = "CONTAINER_ID_PLACEHOLDER";
  const badgeHtmlRef = useRef<string>("");

  useEffect(() => {
    // Store the original badge HTML on first render
    const storeOriginalBadge = () => {
      const container = document.querySelector(`[data-container-id="${containerId}"]`);
      if (container && !badgeHtmlRef.current) {
        badgeHtmlRef.current = container.outerHTML;
      }
    };

    // Re-inject badge if removed
    const reinjectBadge = () => {
      if (!badgeHtmlRef.current) return false;

      // Create temp container to parse HTML
      const temp = document.createElement('div');
      temp.innerHTML = badgeHtmlRef.current;
      const newContainer = temp.firstElementChild;

      if (newContainer) {
        document.body.appendChild(newContainer);
        console.warn("Badge was removed and has been restored");
        return true;
      }
      return false;
    };

    // Protection function to restore badge
    const protectBadge = () => {
      const container = document.querySelector(`[data-container-id="${containerId}"]`) as HTMLElement;
      const badge = document.querySelector(`[data-badge-id="${badgeId}"]`) as HTMLElement;

      // If completely removed, re-inject it
      if (!container) {
        console.warn("Badge container removed - attempting re-injection");
        const reinjected = reinjectBadge();
        if (reinjected) {
          // Re-setup observer after reinjection
          setTimeout(() => setupObserver(), 100);
        }
        return;
      }

      if (!badge) {
        console.warn("Badge element removed - attempting re-injection");
        reinjectBadge();
        return;
      }

      // Check and restore container styles
      if (container.style.display !== 'block') {
        container.style.setProperty('display', 'block', 'important');
      }
      if (container.style.visibility !== 'visible') {
        container.style.setProperty('visibility', 'visible', 'important');
      }
      if (container.style.opacity !== '1') {
        container.style.setProperty('opacity', '1', 'important');
      }
      if (container.style.position !== 'fixed') {
        container.style.setProperty('position', 'fixed', 'important');
      }

      // Check and restore badge styles
      if (badge.style.display === 'none' || badge.style.visibility === 'hidden' || badge.style.opacity === '0') {
        badge.style.setProperty('display', 'block', 'important');
        badge.style.setProperty('visibility', 'visible', 'important');
        badge.style.setProperty('opacity', '1', 'important');
      }

      // Verify data attributes
      if (!container.getAttribute('data-integrity')) {
        container.setAttribute('data-integrity', 'true');
      }
      if (!badge.getAttribute('data-protected')) {
        badge.setAttribute('data-protected', 'true');
      }
    };

    // MutationObserver to detect DOM changes
    const setupObserver = () => {
      const container = document.querySelector(`[data-container-id="${containerId}"]`);
      if (!container) return;

      observerRef.current = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          // Check for removed nodes
          if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
            protectBadge();
          }
          
          // Check for attribute changes (style, class, etc)
          if (mutation.type === 'attributes') {
            const target = mutation.target as HTMLElement;
            if (
              target.hasAttribute('data-badge-id') ||
              target.hasAttribute('data-container-id')
            ) {
              protectBadge();
            }
          }
        }
      });

      // Observe the container and its subtree
      observerRef.current.observe(container, {
        childList: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'data-protected', 'data-integrity'],
        subtree: true,
      });

      // Also observe body for removal of the container itself
      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
      });
    };

    // Initial setup after component mounts
    const initTimeout = setTimeout(() => {
      storeOriginalBadge(); // Store the badge HTML first
      protectBadge();
      setupObserver();

      // Periodic integrity check every 2 seconds
      intervalRef.current = setInterval(() => {
        protectBadge();
      }, 2000);
    }, 100); // Small delay to ensure badge is rendered

    // Cleanup function
    return () => {
      clearTimeout(initTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [badgeId, containerId]);

  // This component doesn't render anything
  return null;
}

export function MadeWithBadgeComponent() {
  // Obfuscated class name - will be replaced at build time
  const badgeId = "BADGE_ID_PLACEHOLDER";
  const containerId = "CONTAINER_ID_PLACEHOLDER";


  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        [data-badge-id="${badgeId}"] {
          position: fixed !important;
          bottom: 0.5rem !important;
          right: 0.5rem !important;
          z-index: 9999 !important;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        [data-container-id="${containerId}"] {
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          transform-origin: bottom right !important;
          transform: scale(0.6) !important;
        }
      `}} />
      <div
        data-container-id={containerId}
        data-integrity="true"
        style={{
          position: 'fixed',
          bottom: '0.5rem',
          right: '0.5rem',
          zIndex: 9999,
          display: 'flex',
          visibility: 'visible',
          opacity: 1,
          pointerEvents: 'auto',
          transformOrigin: 'bottom right'
        }}
      >
        <a
          href={`https://codewords.agemo.ai?utm_source=ui-badge&utm_chat_id=${process.env.NEXT_PUBLIC_CODEWORDS_CHAT_ID || ''}&utm_project_id=${process.env.NEXT_PUBLIC_UI_PROJECT_ID || ''}`}
          target="_blank"
          rel="noopener noreferrer"
          data-badge-id={badgeId}
          data-protected="true"
          data-version="1.0"
          style={{
            display: 'flex',
            alignItems: 'center',
            borderRadius: '16px',
            padding: '1rem 1.25rem',
            visibility: 'visible',
            opacity: 1,
            boxShadow: '0 4px 12px 0 rgba(0, 0, 0, 0.15)',
            backgroundColor: '#000000',
            textDecoration: 'none',
            cursor: 'pointer'
          }}
        >
          <div className="justify-center whitespace-nowrap text-white text-xl font-semibold font-sans-serif leading-5 pr-[6px]">Remix with </div>
          <CWLogo />
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              marginLeft: '0.5rem',
              opacity: 0.6,
              visibility: 'visible'
            }}
          >
            <X className="size-5" style={{ color: '#ffffff' }} />
          </span>
        </a>
      </div>
    </>
  );
}


const CWLogo = () => (
<svg width="151" height="22" viewBox="0 0 151 22" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M121.243 2.92935C121.243 3.13232 121.185 3.28043 121.068 3.37369C120.951 3.46694 120.801 3.51357 120.617 3.51357C120.495 3.51357 120.2 3.45597 119.733 3.34077C119.271 3.22009 118.751 3.12683 118.172 3.061C118.423 3.40112 118.656 3.68637 118.873 3.91677C119.09 4.14168 119.271 4.33094 119.416 4.48454C119.566 4.64362 119.683 4.78351 119.766 4.90419C119.85 5.02488 119.891 5.15379 119.891 5.29093C119.891 5.43904 119.824 5.56796 119.691 5.67767C119.557 5.78738 119.416 5.84224 119.265 5.84224C119.165 5.84224 119.071 5.81481 118.982 5.75996C118.893 5.69961 118.818 5.61733 118.756 5.5131C118.667 5.35402 118.578 5.09893 118.489 4.74785C118.406 4.39677 118.217 3.88111 117.922 3.20089C117.655 3.85368 117.468 4.37208 117.363 4.75608C117.257 5.13459 117.165 5.38693 117.087 5.5131C117.015 5.62281 116.94 5.7051 116.862 5.75996C116.79 5.81481 116.695 5.84224 116.578 5.84224C116.423 5.84224 116.278 5.79013 116.144 5.6859C116.016 5.58167 115.952 5.45002 115.952 5.29093C115.952 5.15927 115.991 5.03585 116.069 4.92065C116.147 4.80545 116.267 4.66008 116.428 4.48454C116.567 4.34191 116.751 4.14717 116.979 3.90031C117.213 3.65346 117.443 3.37369 117.672 3.061C117.126 3.11586 116.617 3.20638 116.144 3.33255C115.677 3.45323 115.371 3.51357 115.226 3.51357C115.043 3.51357 114.893 3.46969 114.776 3.38192C114.659 3.28866 114.601 3.1378 114.601 2.92935C114.601 2.74284 114.659 2.60021 114.776 2.50147C114.893 2.39724 115.043 2.34512 115.226 2.34512C115.393 2.34512 115.685 2.40272 116.103 2.51792C116.525 2.63312 117.048 2.72089 117.672 2.78124C117.455 2.49049 117.226 2.21621 116.987 1.95838C116.748 1.69507 116.562 1.49485 116.428 1.3577C116.272 1.19313 116.153 1.05325 116.069 0.93805C115.991 0.817365 115.952 0.688452 115.952 0.55131C115.952 0.403197 116.019 0.274284 116.153 0.16457C116.286 0.0548567 116.428 0 116.578 0C116.678 0 116.77 0.0274284 116.854 0.0822851C116.943 0.137142 117.021 0.219427 117.087 0.32914C117.165 0.460796 117.268 0.757023 117.396 1.21782C117.524 1.67313 117.699 2.14764 117.922 2.64135C118.172 2.08181 118.353 1.59359 118.464 1.17668C118.581 0.75428 118.678 0.471768 118.756 0.32914C118.818 0.224913 118.89 0.14537 118.973 0.0905136C119.062 0.0301712 119.16 0 119.265 0C119.421 0 119.563 0.0521139 119.691 0.156342C119.824 0.260569 119.891 0.392226 119.891 0.55131C119.891 0.776223 119.735 1.03953 119.424 1.34125C119.118 1.64296 118.701 2.12296 118.172 2.78124C118.773 2.71541 119.293 2.62764 119.733 2.51792C120.178 2.40272 120.473 2.34512 120.617 2.34512C120.801 2.34512 120.951 2.3945 121.068 2.49324C121.185 2.59198 121.243 2.73735 121.243 2.92935Z" fill="#ffffff"/>
<path d="M12.1102 14.4425H14.919C14.2283 18.1723 11.5576 20.2904 7.71275 20.2904C2.83185 20.2904 0 16.8139 0 11.5876C0 6.33836 3.01603 3 7.85089 3C11.5576 3 14.2053 5.11813 14.873 8.84788H12.0641C11.5576 6.59161 9.92298 5.39441 7.7588 5.39441C5.11114 5.39441 3.01603 7.55858 3.01603 11.5876C3.01603 15.6397 5.06509 17.896 7.73578 17.896C9.99205 17.896 11.6037 16.7218 12.1102 14.4425Z" fill="#ffffff"/>
<path d="M18.4026 13.8209C18.4026 16.6758 19.9452 18.0571 21.6719 18.0571C23.3987 18.0571 24.9412 16.6758 24.9412 13.8209C24.9412 10.966 23.3987 9.5616 21.6719 9.5616C19.9452 9.5616 18.4026 10.966 18.4026 13.8209ZM21.6719 7.32835C24.6879 7.32835 27.7731 9.35439 27.7731 13.8209C27.7731 18.2874 24.6879 20.2904 21.6719 20.2904C18.6559 20.2904 15.5708 18.2874 15.5708 13.8209C15.5708 9.35439 18.6559 7.32835 21.6719 7.32835Z" fill="#ffffff"/>
<path d="M37.7094 9.2623V3.2993H40.4492V19.9911H37.7094V18.3564C36.9727 19.5767 35.6834 20.2904 34.0257 20.2904C31.1018 20.2904 28.6383 17.7809 28.6383 13.7979C28.6383 9.83788 31.1018 7.32835 34.0257 7.32835C35.6834 7.32835 36.9727 8.04207 37.7094 9.2623ZM37.8245 13.7979C37.8245 10.943 36.4201 9.5616 34.6243 9.5616C32.8055 9.5616 31.4931 11.1962 31.4931 13.7979C31.4931 16.4225 32.8055 18.0571 34.6243 18.0571C36.4201 18.0571 37.8245 16.6527 37.8245 13.7979Z" fill="#ffffff"/>
<path d="M53.3076 14.5806H44.0754C44.2595 16.883 45.8712 18.0111 47.4367 18.0111C48.8642 18.0111 49.9923 17.4355 50.4758 16.2844H53.1695C52.5939 18.2643 50.7521 20.2904 47.5518 20.2904C43.5688 20.2904 41.2896 17.2513 41.2896 13.7058C41.2896 9.97601 43.8451 7.32835 47.3677 7.32835C51.1665 7.32835 53.5379 10.4135 53.3076 14.5806ZM47.3677 9.46951C46.0784 9.46951 44.3056 10.2293 44.0754 12.5776H50.5218C50.4528 10.6437 48.9793 9.46951 47.3677 9.46951Z" fill="#ffffff"/>
<path d="M64.1528 3.2993L67.0077 16.2153L69.5402 3.2993H72.6023L68.7114 19.9911H65.2579L62.4491 7.19021L59.6863 19.9911H56.1868L52.2728 3.2993H55.45L56.7854 9.74578L58.1207 16.1923L60.7684 3.2993H64.1528Z" fill="#ffffff"/>
<path d="M74.1847 13.8209C74.1847 16.6758 75.7273 18.0571 77.454 18.0571C79.1807 18.0571 80.7233 16.6758 80.7233 13.8209C80.7233 10.966 79.1807 9.5616 77.454 9.5616C75.7273 9.5616 74.1847 10.966 74.1847 13.8209ZM77.454 7.32835C80.47 7.32835 83.5551 9.35439 83.5551 13.8209C83.5551 18.2874 80.47 20.2904 77.454 20.2904C74.438 20.2904 71.3529 18.2874 71.3529 13.8209C71.3529 9.35439 74.438 7.32835 77.454 7.32835Z" fill="#ffffff"/>
<path d="M91.3521 7.62765V10.3904C90.8917 10.3444 90.4542 10.3214 90.0398 10.3214C88.3131 10.3214 87.3231 11.0121 87.3231 13.4986V19.9911H84.5833V13.7979V7.60463H87.277V9.81485C87.9447 8.43346 89.1419 7.60463 90.6384 7.58161C90.8456 7.58161 91.1449 7.60463 91.3521 7.62765Z" fill="#ffffff"/>
<path d="M100.528 9.2623V3.2993H103.268V19.9911H100.528V18.3564C99.7912 19.5767 98.5019 20.2904 96.8443 20.2904C93.9203 20.2904 91.4568 17.7809 91.4568 13.7979C91.4568 9.83788 93.9203 7.32835 96.8443 7.32835C98.5019 7.32835 99.7912 8.04207 100.528 9.2623ZM100.643 13.7979C100.643 10.943 99.2387 9.5616 97.4428 9.5616C95.624 9.5616 94.3117 11.1962 94.3117 13.7979C94.3117 16.4225 95.624 18.0571 97.4428 18.0571C99.2387 18.0571 100.643 16.6527 100.643 13.7979Z" fill="#ffffff"/>
<path d="M114.356 10.989H111.777C111.478 9.8609 110.442 9.42346 109.06 9.42346C107.863 9.42346 106.758 9.95299 106.758 10.7818C106.758 11.6107 107.357 12.0481 108.416 12.2553L110.165 12.6007C112.675 13.0841 114.586 13.8669 114.586 16.2844C114.586 18.863 112.145 20.2904 109.337 20.2904C106.298 20.2904 104.272 18.5637 103.972 16.2153H106.643C106.896 17.4816 107.817 18.2183 109.429 18.2183C110.856 18.2183 111.915 17.6197 111.915 16.6067C111.915 15.5937 110.994 15.1332 109.774 14.903L107.909 14.5346C105.814 14.1202 104.179 13.1762 104.179 10.92C104.179 8.73276 106.528 7.32835 109.222 7.32835C111.639 7.32835 113.849 8.50253 114.356 10.989Z" fill="#ffffff"/>
</svg>

)