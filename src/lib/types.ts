export type HouseId = 'shivaji' | 'nehru' | 'karve' | 'rana-pratap' | 'shastri' | 'tilak'

export type MembershipStatus = 'none' | 'pending' | 'active' | 'suspended' | 'removed'
export type MembershipRole = 'batchmate' | 'coordinator'
export type Membership = { status: MembershipStatus; role?: MembershipRole; houseId?: HouseId | null }
