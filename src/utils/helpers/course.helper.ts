export class CourseHelper {
  static getTotalSessionPerSemester(credits: number): number {
    if (credits <= 2) {
      return 5;
    } else if (credits === 3) {
      return 10;
    } else if (credits === 4) {
      return 12;
    } else if (credits === 5) {
      return 15;
    }
    return 1;
  }

  static mergeAndMarkClassGroups<T extends number, U extends number>(
    cancelClassGroupIds: T[],
    registeredClassGroupIds: U[],
  ): (
    | { classGroupId: T; isRegistered: false }
    | { classGroupId: U; isRegistered: true }
  )[] {
    const cancelledItems = cancelClassGroupIds.map((item) => ({
      classGroupId: item,
      isRegistered: false as const,
    }));

    const registeredItems = registeredClassGroupIds.map((item) => ({
      classGroupId: item,
      isRegistered: true as const,
    }));

    return [...cancelledItems, ...registeredItems];
  }
}
