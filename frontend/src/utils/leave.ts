import { Role } from '../types';

/**
 * Returns true when the reviewer is allowed to approve/reject the given applicant's leave.
 * Only SUPER_ADMIN can review leave requests from LAB_ADMIN or SUPER_ADMIN users.
 */
export const canReviewLeave = (
  applicantRole: Role | string | undefined,
  reviewerRole: Role | string | undefined,
): boolean => {
  const isTargetAdmin =
    applicantRole === Role.LAB_ADMIN || applicantRole === Role.SUPER_ADMIN;
  return !isTargetAdmin || reviewerRole === Role.SUPER_ADMIN;
};
