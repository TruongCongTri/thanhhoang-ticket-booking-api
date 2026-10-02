import { CaslAbilityFactory } from './casl-ability.factory';
import { Action, PermissionEffect, Scope } from './access-control.types';
import { RequestUserContext } from '../context/request-context.model';

describe('CaslAbilityFactory with Direct Overrides (Grant/Deny) & ABAC', () => {
  let factory: CaslAbilityFactory;

  beforeEach(() => {
    factory = new CaslAbilityFactory();
  });

  // =========================================================================
  // NHÓM 1: KIỂM CHUẨN CÁC PHẠM VI QUYỀN CƠ BẢN (GLOBAL, OWN, DEPARTMENT)
  // =========================================================================

  it('should grant GLOBAL permission regardless of attributes', () => {
    const superAdmin: RequestUserContext = {
      id: 'usr_root',
      email: 'superadmin@travel.com',
      roles: ['SUPER_ADMIN'],
      rules: [
        {
          resource: 'bookings',
          action: Action.MANAGE,
          scope: Scope.GLOBAL,
          effect: PermissionEffect.GRANT,
        },
      ],
    };

    const ability = factory.createForUser(superAdmin);
    const anyBooking = {
      __type: 'bookings',
      userId: 'usr_random',
      departmentId: 'dep_ANY',
    };

    // Chuỗi String Resource
    expect(ability.can(Action.READ, 'bookings')).toBe(true);
    expect(ability.can(Action.DELETE, 'bookings')).toBe(true);

    // Object Entity bất kỳ
    expect(ability.can(Action.READ, anyBooking)).toBe(true);
    expect(ability.can(Action.DELETE, anyBooking)).toBe(true);
  });

  it('should restrict OWN scoped permissions to user owned entities only', () => {
    const agentUser: RequestUserContext = {
      id: 'usr_2',
      email: 'agent@travel.com',
      roles: ['AGENT'],
      rules: [
        {
          resource: 'bookings',
          action: Action.READ,
          scope: Scope.OWN, // Đã chuẩn hóa về OWN scope
          effect: PermissionEffect.GRANT,
        },
      ],
    };

    const ability = factory.createForUser(agentUser);

    const myBooking = {
      __type: 'bookings',
      userId: 'usr_2',
      departmentId: 'dep_A',
    };
    const otherBooking = {
      __type: 'bookings',
      userId: 'usr_999',
      departmentId: 'dep_A',
    };

    expect(ability.can(Action.READ, myBooking)).toBe(true);
    expect(ability.can(Action.READ, otherBooking)).toBe(false);
  });

  it('should restrict DEPARTMENT scoped permissions to matching department', () => {
    const leadUser: RequestUserContext = {
      id: 'usr_3',
      email: 'lead@travel.com',
      departmentId: 'dep_SALES',
      roles: ['LEAD'],
      rules: [
        {
          resource: 'bookings',
          action: Action.READ,
          scope: Scope.DEPARTMENT,
          effect: PermissionEffect.GRANT,
        },
      ],
    };

    const ability = factory.createForUser(leadUser);

    const salesBooking = {
      __type: 'bookings',
      userId: 'usr_x',
      departmentId: 'dep_SALES',
    };
    const itBooking = {
      __type: 'bookings',
      userId: 'usr_y',
      departmentId: 'dep_IT',
    };

    expect(ability.can(Action.READ, salesBooking)).toBe(true);
    expect(ability.can(Action.READ, itBooking)).toBe(false);
  });

  // =========================================================================
  // NHÓM 2: CƠ CHẾ GHI ĐÈ TRỰC TIẾP (DIRECT OVERRIDES: GRANT / DENY)
  // =========================================================================

  it('should allow actions from MANAGE but block specific action with direct DENY override', () => {
    const managerUser: RequestUserContext = {
      id: 'usr_1',
      email: 'admin@travel.com',
      departmentId: 'dep_OPERATIONS',
      roles: ['ADMIN'],
      rules: [
        // 1. Quyền kế thừa từ Role: Toàn quyền trên Bookings phạm vi phòng ban
        {
          resource: 'bookings',
          action: Action.MANAGE,
          scope: Scope.DEPARTMENT,
          effect: PermissionEffect.GRANT,
        },
        // 2. Quyền Override trực tiếp (Direct Deny): Cấm xóa bất kể Role là gì
        {
          resource: 'bookings',
          action: Action.DELETE,
          scope: Scope.DEPARTMENT,
          effect: PermissionEffect.DENY,
        },
      ],
    };

    const ability = factory.createForUser(managerUser);
    const departmentBooking = {
      __type: 'bookings',
      departmentId: 'dep_OPERATIONS',
    };

    // Vẫn đọc và cập nhật bình thường nhờ MANAGE
    expect(ability.can(Action.READ, departmentBooking)).toBe(true);
    expect(ability.can(Action.UPDATE, departmentBooking)).toBe(true);

    // Bị chặn xóa tuyệt đối vì Explicit Deny ghi đè MANAGE
    expect(ability.can(Action.DELETE, departmentBooking)).toBe(false);
  });

  it('should enforce Direct DENY even when the user has GLOBAL GRANT', () => {
    const auditedAdmin: RequestUserContext = {
      id: 'usr_admin_restricted',
      email: 'admin_restricted@travel.com',
      roles: ['ADMIN'],
      rules: [
        // Role cho phép toàn quyền hệ thống
        {
          resource: 'bookings',
          action: Action.MANAGE,
          scope: Scope.GLOBAL,
          effect: PermissionEffect.GRANT,
        },
        // Phủ quyết trực tiếp: Cấm hoàn tiền (EXECUTE)
        {
          resource: 'bookings',
          action: Action.EXECUTE,
          scope: Scope.GLOBAL,
          effect: PermissionEffect.DENY,
        },
      ],
    };

    const ability = factory.createForUser(auditedAdmin);
    const booking = { __type: 'bookings', id: 'bk_123' };

    expect(ability.can(Action.READ, booking)).toBe(true);
    expect(ability.can(Action.UPDATE, booking)).toBe(true);
    // Explicit Deny wins over Global Grant
    expect(ability.can(Action.EXECUTE, booking)).toBe(false);
  });

  it('should grant temporary bonus permission via Direct GRANT override', () => {
    const regularAgent: RequestUserContext = {
      id: 'usr_agent_bonus',
      email: 'agent_bonus@travel.com',
      departmentId: 'dep_SALES',
      roles: ['SALES_AGENT'],
      rules: [
        // Role chỉ được đọc đơn phòng mình
        {
          resource: 'bookings',
          action: Action.READ,
          scope: Scope.DEPARTMENT,
          effect: PermissionEffect.GRANT,
        },
        // Direct Grant (Bonus): Đặc quyền xuất vé (EXECUTE) toàn hệ thống
        {
          resource: 'bookings',
          action: Action.EXECUTE,
          scope: Scope.GLOBAL,
          effect: PermissionEffect.GRANT,
        },
      ],
    };

    const ability = factory.createForUser(regularAgent);
    const otherDepartmentBooking = {
      __type: 'bookings',
      departmentId: 'dep_MARKETING',
    };

    // Không được xem đơn của phòng ban khác
    expect(ability.can(Action.READ, otherDepartmentBooking)).toBe(false);
    // Nhưng có quyền xuất vé đơn này nhờ Bonus Direct Grant
    expect(ability.can(Action.EXECUTE, otherDepartmentBooking)).toBe(true);
  });

  // =========================================================================
  // NHÓM 3: ĐIỀU KIỆN ABAC MỞ RỘNG (CUSTOM CONDITIONS) & TRƯỜNG HỢP BIÊN
  // =========================================================================

  it('should evaluate custom conditions (e.g., status-based ABAC constraint)', () => {
    const operatorUser: RequestUserContext = {
      id: 'usr_operator',
      email: 'operator@travel.com',
      roles: ['OPERATOR'],
      rules: [
        {
          resource: 'bookings',
          action: Action.UPDATE,
          scope: Scope.GLOBAL,
          effect: PermissionEffect.GRANT,
          // Chỉ cho phép cập nhật khi trạng thái đơn còn là DRAFT
          conditions: { status: 'DRAFT' },
        },
      ],
    };

    const ability = factory.createForUser(operatorUser);

    const draftBooking = { __type: 'bookings', status: 'DRAFT' };
    const paidBooking = { __type: 'bookings', status: 'PAID' };

    expect(ability.can(Action.UPDATE, draftBooking)).toBe(true);
    expect(ability.can(Action.UPDATE, paidBooking)).toBe(false);
  });

  it('should deny all actions when user has no permissions (fail-safe default)', () => {
    const guestUser: RequestUserContext = {
      id: 'usr_guest',
      email: 'guest@travel.com',
      roles: [],
      rules: [],
    };

    const ability = factory.createForUser(guestUser);
    const anyBooking = { __type: 'bookings', userId: 'usr_guest' };

    expect(ability.can(Action.READ, 'bookings')).toBe(false);
    expect(ability.can(Action.READ, anyBooking)).toBe(false);
    expect(ability.can(Action.DELETE, anyBooking)).toBe(false);
  });

  it('should NOT grant DEPARTMENT scope to a user without departmentId (privilege escalation guard)', () => {
    const noDeptUser: RequestUserContext = {
      id: 'usr_nodept',
      email: 'nodept@travel.com',
      roles: ['AGENT'],
      rules: [
        {
          resource: 'bookings',
          action: Action.READ,
          scope: Scope.DEPARTMENT,
          effect: PermissionEffect.GRANT,
        },
      ],
    };

    const ability = factory.createForUser(noDeptUser);
    // Không có departmentId: điều kiện {departmentId: undefined} từng khớp mọi bản ghi thiếu departmentId
    expect(ability.can(Action.READ, { __type: 'bookings' })).toBe(false);
    expect(factory.hasScope(noDeptUser, 'bookings', Action.READ, Scope.OWN)).toBe(false);
  });

  it('should not let custom conditions widen the scope condition', () => {
    const user: RequestUserContext = {
      id: 'usr_x',
      email: 'x@travel.com',
      departmentId: 'dep_SALES',
      roles: [],
      rules: [
        {
          resource: 'bookings',
          action: Action.READ,
          scope: Scope.DEPARTMENT,
          effect: PermissionEffect.GRANT,
          conditions: { departmentId: 'dep_FINANCE' },
        },
      ],
    };

    const ability = factory.createForUser(user);
    expect(ability.can(Action.READ, { __type: 'bookings', departmentId: 'dep_FINANCE' })).toBe(false);
    expect(ability.can(Action.READ, { __type: 'bookings', departmentId: 'dep_SALES' })).toBe(true);
  });

  it('should rank scopes GLOBAL > DEPARTMENT > OWN when checking required scope', () => {
    const globalReader: RequestUserContext = {
      id: 'usr_g',
      email: 'g@travel.com',
      roles: [],
      rules: [
        { resource: 'bookings', action: Action.MANAGE, scope: Scope.GLOBAL, effect: PermissionEffect.GRANT },
      ],
    };

    expect(factory.hasScope(globalReader, 'bookings', Action.READ, Scope.DEPARTMENT)).toBe(true);
    expect(factory.hasScope(globalReader, 'payments', Action.READ, Scope.OWN)).toBe(false);
  });

  it('should memoize the ability per user object', () => {
    const user: RequestUserContext = { id: 'u', email: 'u@x', roles: [], rules: [] };
    expect(factory.createForUser(user)).toBe(factory.createForUser(user));
  });
});

// npx jest src/core/access-control/casl-ability.factory.spec.ts