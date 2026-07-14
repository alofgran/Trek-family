// FE-COMP-COSTS: settlements surfaced inline in the Costs ledger (issue #1241)
import { render, screen, waitFor } from '../../../tests/helpers/render'
import { http, HttpResponse } from 'msw'
import { server } from '../../../tests/helpers/msw/server'
import { useAuthStore } from '../../store/authStore'
import { useTripStore } from '../../store/tripStore'
import { useSettingsStore } from '../../store/settingsStore'
import { resetAllStores, seedStore } from '../../../tests/helpers/store'
import { buildUser, buildTrip, buildBudgetItem, buildSettings } from '../../../tests/helpers/factories'
import CostsPanel from './CostsPanel'

const tripMembers = [
  { id: 1, username: 'alice', avatar_url: null },
  { id: 2, username: 'bob', avatar_url: null },
]

// Each account holder's own linked traveler — mirrors what a real trip bootstrap
// (loadTrip) populates tripTravelers with before the Costs tab ever mounts.
const tripTravelers = [
  { id: 101, managed_by_user_id: 1, linked_user_id: 1, name: 'Alice', avatar: null, color: null, type: 'adult' as const, created_at: '2025-01-01T00:00:00.000Z', added_at: '2025-01-01T00:00:00.000Z', added_by_user_id: 1 },
  { id: 102, managed_by_user_id: 2, linked_user_id: 2, name: 'Bob', avatar: null, color: null, type: 'adult' as const, created_at: '2025-01-01T00:00:00.000Z', added_at: '2025-01-01T00:00:00.000Z', added_by_user_id: 2 },
]

beforeEach(() => {
  resetAllStores()
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true })
  seedStore(useTripStore, { trip: buildTrip({ id: 1, currency: 'EUR' }), tripTravelers })
  // Match the display currency to the trip currency so amounts render without
  // going through the (async, network-dependent) cross-currency conversion path.
  seedStore(useSettingsStore, { settings: buildSettings({ default_currency: 'EUR' }) })
})

describe('CostsPanel — settlements in the ledger', () => {
  it('renders a settle-up payment as a ledger row with an undo action', async () => {
    const item = { ...buildBudgetItem({ trip_id: 1, category: 'food', name: 'Dinner' }), total_price: 90, expense_date: '2025-06-15' }
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [item] })),
      http.get('/api/trips/1/budget/settlement', () =>
        HttpResponse.json({
          balances: [],
          flows: [],
          settlements: [
            { id: 7, trip_id: 1, from_user_id: 2, to_user_id: 1, amount: 30, created_at: '2025-06-16 10:00:00', from_username: 'bob', to_username: 'alice' },
          ],
        })
      ),
    )
    render(<CostsPanel tripId={1} tripMembers={tripMembers} />)

    // The expense and the settlement (payment) both appear in the unified ledger.
    await screen.findByText('Dinner')
    await screen.findByText('Payment')
    // The payment row exposes an inline undo (no need to open a separate History modal).
    expect(screen.getByTitle('Undo')).toBeInTheDocument()
  })

  it('records a manual payment via the Add payment button', async () => {
    let posted: Record<string, unknown> | null = null
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [] })),
      http.get('/api/trips/1/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })),
      http.post('/api/trips/1/budget/settlements', async ({ request }) => {
        posted = await request.json() as Record<string, unknown>
        return HttpResponse.json({ settlement: { id: 1, ...posted } })
      }),
    )
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<CostsPanel tripId={1} tripMembers={tripMembers} />)

    await user.click(await screen.findByRole('button', { name: 'Add payment' }))
    await user.type(await screen.findByPlaceholderText('0.00'), '25')
    // The footer submit is the second "Add payment" control once the modal is open.
    const addButtons = screen.getAllByRole('button', { name: 'Add payment' })
    const submit = addButtons[addButtons.length - 1]
    await user.click(submit)
    await waitFor(() => expect(posted).toMatchObject({ amount: 25 }))
  })

  it('hides payment rows while a text search is active', async () => {
    const item = { ...buildBudgetItem({ trip_id: 1, category: 'food', name: 'Dinner' }), total_price: 90, expense_date: '2025-06-15' }
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [item] })),
      http.get('/api/trips/1/budget/settlement', () =>
        HttpResponse.json({
          balances: [],
          flows: [],
          settlements: [
            { id: 7, trip_id: 1, from_user_id: 2, to_user_id: 1, amount: 30, created_at: '2025-06-16 10:00:00', from_username: 'bob', to_username: 'alice' },
          ],
        })
      ),
    )
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<CostsPanel tripId={1} tripMembers={tripMembers} />)

    await screen.findByText('Payment')
    await user.type(screen.getByPlaceholderText('Search expenses…'), 'Dinner')
    // Payment rows have no name, so a search hides them while the matching expense stays.
    expect(screen.queryByText('Payment')).not.toBeInTheDocument()
    expect(screen.getByText('Dinner')).toBeInTheDocument()
  })

  it('auto-splits the total across participants and rebalances a pinned amount on save', async () => {
    let posted: Record<string, unknown> | null = null
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [] })),
      http.get('/api/trips/1/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })),
      http.post('/api/trips/1/budget', async ({ request }) => {
        posted = await request.json() as Record<string, unknown>
        return HttpResponse.json({ item: { ...buildBudgetItem({ trip_id: 1, name: 'Dinner' }), id: 5 } })
      }),
    )
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<CostsPanel tripId={1} tripMembers={tripMembers} />)

    await user.click(await screen.findByRole('button', { name: 'Add expense' }))
    await user.type(await screen.findByPlaceholderText('e.g. Dinner, souvenirs, gas…'), 'Dinner')
    const nums = () => screen.getAllByPlaceholderText('0.00') as HTMLInputElement[]
    await user.type(nums()[0], '100') // total → auto equal-split across the 2 participants
    await waitFor(() => expect(nums()[1].value).toBe('50'))
    expect(nums()[2].value).toBe('50')
    // Pin the first participant to 30 → the other non-pinned field rebalances to 70.
    await user.clear(nums()[1]); await user.type(nums()[1], '30')
    await waitFor(() => expect(nums()[2].value).toBe('70'))

    const addBtns = screen.getAllByRole('button', { name: 'Add expense' })
    await user.click(addBtns[addBtns.length - 1]) // footer submit
    await waitFor(() => expect(posted).toBeTruthy())
    expect(posted!.total_price).toBe(100)
    expect(posted!.payers).toEqual(expect.arrayContaining([
      expect.objectContaining({ user_id: 1, amount: 30 }),
      expect.objectContaining({ user_id: 2, amount: 70 }),
    ]))
  })

  it('accepts a comma as the decimal separator in the total amount (#1256)', async () => {
    let posted: Record<string, unknown> | null = null
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [] })),
      http.get('/api/trips/1/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })),
      http.post('/api/trips/1/budget', async ({ request }) => {
        posted = await request.json() as Record<string, unknown>
        return HttpResponse.json({ item: { ...buildBudgetItem({ trip_id: 1, name: 'AirTags' }), id: 6 } })
      }),
    )
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<CostsPanel tripId={1} tripMembers={tripMembers} />)

    await user.click(await screen.findByRole('button', { name: 'Add expense' }))
    await user.type(await screen.findByPlaceholderText('e.g. Dinner, souvenirs, gas…'), 'AirTags')
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '39,99') // comma → normalized to 39.99

    const addBtns = screen.getAllByRole('button', { name: 'Add expense' })
    await user.click(addBtns[addBtns.length - 1]) // footer submit
    await waitFor(() => expect(posted).toBeTruthy())
    expect(posted!.total_price).toBe(39.99)
  })

  it('marks an expense with no payer as Unfinished', async () => {
    const item = { ...buildBudgetItem({ trip_id: 1, category: 'food', name: 'Hotel' }), total_price: 90, payers: [], members: [{ user_id: 1, username: 'alice', paid: 0 }] }
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [item] })),
      http.get('/api/trips/1/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })),
    )
    render(<CostsPanel tripId={1} tripMembers={tripMembers} />)
    await screen.findByText('Hotel')
    expect(screen.getByText('Unfinished')).toBeInTheDocument()
  })

  it('records a recorded-total expense with nobody to split with (#1286)', async () => {
    let posted: Record<string, unknown> | null = null
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [] })),
      http.get('/api/trips/1/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })),
      http.post('/api/trips/1/budget', async ({ request }) => {
        posted = await request.json() as Record<string, unknown>
        return HttpResponse.json({ item: { ...buildBudgetItem({ trip_id: 1, name: 'Hotel' }), id: 9 } })
      }),
    )
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(<CostsPanel tripId={1} tripMembers={tripMembers} />)

    await user.click(await screen.findByRole('button', { name: 'Add expense' }))
    await user.type(await screen.findByPlaceholderText('e.g. Dinner, souvenirs, gas…'), 'Hotel')
    await user.type(screen.getAllByPlaceholderText('0.00')[0], '120') // total only, paid on-site later

    // Deselect everyone — the cost is recorded without a split (the bug: this was blocked).
    // The participant toggles are buttons; the same names also appear as plain text in
    // the Balances sidebar, so target the buttons specifically.
    await user.click(screen.getByRole('button', { name: /alice/i }))
    await user.click(screen.getByRole('button', { name: /bob/i }))

    const addBtns = screen.getAllByRole('button', { name: 'Add expense' })
    const submit = addBtns[addBtns.length - 1] // footer submit
    expect(submit).not.toBeDisabled()
    await user.click(submit)

    await waitFor(() => expect(posted).toBeTruthy())
    expect(posted!.total_price).toBe(120)
    expect(posted!.member_ids).toEqual([])
    expect(posted!.payers).toEqual([])
  })
})

describe('CostsPanel — payer identity uses traveler_id, not the account it settles under', () => {
  it('shows each traveler\'s own name for payer chips instead of "You" for every child sharing the manager account (#reported bug)', async () => {
    const parent = buildUser()
    seedStore(useAuthStore, { user: parent, isAuthenticated: true })
    seedStore(useTripStore, {
      trip: buildTrip({ id: 1, currency: 'EUR' }),
      tripTravelers: [
        { id: 301, managed_by_user_id: parent.id, linked_user_id: parent.id, name: 'Parent', avatar: null, color: null, type: 'adult' as const, created_at: '2025-01-01T00:00:00.000Z', added_at: '2025-01-01T00:00:00.000Z', added_by_user_id: parent.id },
        { id: 302, managed_by_user_id: parent.id, linked_user_id: null, name: 'Kid One', avatar: null, color: null, type: 'child' as const, created_at: '2025-01-01T00:00:00.000Z', added_at: '2025-01-01T00:00:00.000Z', added_by_user_id: parent.id },
        { id: 303, managed_by_user_id: parent.id, linked_user_id: null, name: 'Kid Two', avatar: null, color: null, type: 'child' as const, created_at: '2025-01-01T00:00:00.000Z', added_at: '2025-01-01T00:00:00.000Z', added_by_user_id: parent.id },
      ],
    })
    const item = {
      ...buildBudgetItem({ trip_id: 1, category: 'food', name: 'Snacks' }),
      total_price: 20,
      payers: [
        { user_id: parent.id, traveler_id: 302, amount: 12, username: 'parent' },
        { user_id: parent.id, traveler_id: 303, amount: 8, username: 'parent' },
      ],
      members: [],
    }
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [item] })),
      http.get('/api/trips/1/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })),
    )
    render(<CostsPanel tripId={1} tripMembers={[{ id: parent.id, username: 'parent', avatar_url: null }]} />)

    await screen.findByText('Snacks')
    expect(screen.getByTitle('Kid One')).toBeInTheDocument()
    expect(screen.getByTitle('Kid Two')).toBeInTheDocument()
    expect(screen.queryByTitle('You')).not.toBeInTheDocument()
  })
})

describe('CostsPanel — cost-per-traveler primary summary', () => {
  it('splits each expense equally across its participating travelers and sums per traveler', async () => {
    const item = {
      ...buildBudgetItem({ trip_id: 1, category: 'food', name: 'Dinner' }),
      total_price: 100,
      payers: [],
      members: [
        { user_id: 1, traveler_id: 101, paid: 0, username: 'alice' },
        { user_id: 2, traveler_id: 102, paid: 0, username: 'bob' },
      ],
    }
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [item] })),
      http.get('/api/trips/1/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })),
    )
    render(<CostsPanel tripId={1} tripMembers={tripMembers} />)

    await screen.findByText('Cost per traveler')
    // "Alice"/"Bob" also appear as the expense row's participant chips, so at
    // least one match (rather than exactly one) confirms the summary rendered.
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bob').length).toBeGreaterThan(0)
    // €100 split 2 ways = €50 each, shown once per traveler row.
    expect(screen.getAllByText(/50[.,]00/)).toHaveLength(2)
  })

  it('omits travelers with no attributed cost from the breakdown', async () => {
    const item = {
      ...buildBudgetItem({ trip_id: 1, category: 'food', name: 'Solo snack' }),
      total_price: 10,
      payers: [],
      members: [{ user_id: 1, traveler_id: 101, paid: 0, username: 'alice' }],
    }
    server.use(
      http.get('/api/trips/1/budget', () => HttpResponse.json({ items: [item] })),
      http.get('/api/trips/1/budget/settlement', () => HttpResponse.json({ balances: [], flows: [], settlements: [] })),
    )
    render(<CostsPanel tripId={1} tripMembers={tripMembers} />)

    await screen.findByText('Cost per traveler')
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
    expect(screen.queryByText('Bob')).not.toBeInTheDocument()
  })
})
