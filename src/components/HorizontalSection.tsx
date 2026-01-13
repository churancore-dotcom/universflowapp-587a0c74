import React, { memo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { staggerContainer } from '@/lib/animations';

interface HorizontalSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onSeeAll?: () => void;
}

const HorizontalSection = memo(({ title, subtitle, children, onSeeAll }: HorizontalSectionProps) => {
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-5 px-1">
        <div>
          <h2 className="text-[22px] md:text-2xl font-semibold tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {onSeeAll && (
          <button
            className="flex items-center gap-1 text-sm text-primary font-medium active:scale-95 transition-transform"
            onClick={onSeeAll}
          >
            See All
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <motion.div 
        className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x snap-mandatory -mx-6 px-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {children}
      </motion.div>
    </section>
  );
});

HorizontalSection.displayName = 'HorizontalSection';

export default HorizontalSection;
