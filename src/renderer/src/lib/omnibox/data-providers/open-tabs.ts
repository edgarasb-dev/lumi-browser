export async function getOpenTabsInSpace() {
  const spaceId = await lumi.spaces.getUsingSpace();
  if (!spaceId) return [];

  const tabsData = await lumi.tabs.getData();

  const tabs = tabsData.tabs.filter((tab) => tab.spaceId === spaceId);
  return tabs;
}
