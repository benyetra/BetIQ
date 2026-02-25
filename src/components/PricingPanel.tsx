"use client"
import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Sparkles, Zap, Crown } from 'lucide-react'

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: Sparkles,
    description: 'Get started with basic analytics',
    features: [
      'Upload up to 500 bets',
      'Basic dashboard (P/L, win rate, sport breakdown)',
      '3 AI insights per upload',
      'Basic trend charts',
      'Responsible gambling resources',
    ],
    cta: 'Current Plan',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    icon: Zap,
    description: 'Full analytics and AI coaching',
    features: [
      'Unlimited bet uploads',
      'Full dashboard with all filters',
      'Unlimited AI insights',
      'AI Chat Coach (50 messages/mo)',
      'Strategy builder',
      'What-if simulator',
      'Weekly performance digest',
      'Advanced prop analysis',
      'Behavioral pattern detection',
    ],
    cta: 'Upgrade to Pro',
    highlight: true,
  },
  {
    name: 'Sharp',
    price: '$24.99',
    period: '/month',
    icon: Crown,
    description: 'For serious bettors seeking an edge',
    features: [
      'Everything in Pro',
      'Unlimited AI chat',
      'Closing line & EV analysis',
      'Advanced CLV tracking',
      'What-if simulator (unlimited)',
      'Custom alerts & notifications',
      'API access for programmatic uploads',
      'Priority processing',
      'Sportsbook comparison tools',
    ],
    cta: 'Go Sharp',
    highlight: false,
  },
]

export default function PricingPanel() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Your Plan</h2>
        <p className="text-zinc-400">Start free, upgrade when you&apos;re ready to get serious.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map(tier => {
          const Icon = tier.icon
          return (
            <Card
              key={tier.name}
              className={`relative ${tier.highlight ? 'border-emerald-600 ring-1 ring-emerald-600' : ''}`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="positive" className="px-3 py-1">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center">
                <Icon className={`h-8 w-8 mx-auto mb-2 ${tier.highlight ? 'text-emerald-400' : 'text-zinc-400'}`} />
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-white">{tier.price}</span>
                  <span className="text-zinc-400 text-sm">{tier.period}</span>
                </div>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {tier.features.map(feature => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={tier.highlight ? 'default' : 'outline'}
                >
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
