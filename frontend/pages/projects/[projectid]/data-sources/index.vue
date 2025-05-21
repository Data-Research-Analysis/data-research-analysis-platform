<script setup>
const route = useRoute();
const router = useRouter();
onMounted(() => {
    console.log(route.fullPath);
    let path = route.fullPath.split('/');
    path = path.filter((item, index) => index < path.length - 1).join('/');
    router.push(path);
});
function openDialog() {
    state.show_dialog = true;
}
function closeDialog() {
    state.show_dialog = false;
}

function getDataSources() {
    state.data_sources = [];
    console.log('getDataSources dataSourceStore.getDataSources()', dataSourceStore.getDataSources());
    state.data_sources = dataSourceStore.getDataSources().filter((dataSource) => dataSource?.project?.id === project?.value?.id).map((dataSource) => {
        return {
            id: dataSource.id,
            name: dataSource.name,
            data_type: dataSource.data_type,
            connection_details: dataSource.connection_details,
            user_id: dataSource.user_platform_id,
            project_id: dataSource.project_id,
        }
    });
}
async function deleteDataSource(dataSourceId) {
    const { value: confirmDelete } = await $swal.fire({
        title: "Are you sure you want to delete the data source?",
        text: "You won't be able to revert this!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3C8DBC",
        cancelButtonColor: "#DD4B39",
        confirmButtonText: "Yes, delete it!",
    });
    if (!confirmDelete) {
        return;
    }
    const token = getAuthToken();
    const requestOptions = {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization-Type": "auth",
        },
    };
    const response = await fetch(`${baseUrl()}/data-source/delete/${dataSourceId}`, requestOptions);
    if (response && response.status === 200) {
        const data = await response.json();
        $swal.fire(`The data source has been deleted successfully.`);
    } else {
        $swal.fire(`There was an error deleting the data source.`);
    }
    await dataSourceStore.retrieveDataSources();
    getDataSources();
}
async function setSelectedDataSource(dataSourceId) {
    const dataSource = state.data_sources.find((dataSource) => dataSource.id === dataSourceId);
    dataSourceStore.setSelectedDataSource(dataSource);
}

onMounted(async () => {
    getDataSources();
})
</script>
<template>
    <div class="min-h-100"></div>
</template>