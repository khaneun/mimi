"use client"

import { Github } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

export function ProjectFooter() {
  const { t, language } = useLanguage()
  return (
    <footer className="mt-12 border-t border-border/30">
      <div className="container mx-auto px-4 py-6 max-w-[1600px]">
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>© 2025 MarketPulse</span>
            <span className="text-border/50">•</span>
            <span>MIT License</span>
            <span className="text-border/50">•</span>
            <a
              href="https://github.com/jacob119/market-pulse"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
          </div>
          <p className="text-muted-foreground/50 text-center">
            {t("footer.disclaimer")}
          </p>
        </div>
      </div>
    </footer>
  )
}
