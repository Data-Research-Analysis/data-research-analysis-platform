<script setup>
const { $swal } = useNuxtApp();
const state = reactive({
    project_name: '',
    projects: [],
})
async function addProject() {
    const inputValue = "";
    const { value: projectName } = await $swal.fire({
    title: "Enter Project Name",
    input: "text",
    inputLabel: "Project Name",
    inputValue,
    showCancelButton: true,
    confirmButtonColor: "#3C8DBC",
    cancelButtonColor: "#DD4B39",
    inputValidator: (value) => {
        if (!value) {
            return "Please enter in a name for the project!";
        }
    }
    });
    if (projectName) {
        state.project_name = projectName;
        const token = getAuthToken();
        const requestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Authorization_Type": "auth",
            },
            body: JSON.stringify({
                project_name: projectName,
            }),
        };
        const response = await fetch(`${baseUrl()}/project/add`, requestOptions);
        if (response && response.status === 200) {
            const data = await response.json();
            $swal.fire({
                title: `The project ${projectName} has been created successfully.`,
                confirmButtonColor: "#3C8DBC",
            });
            getProjects();
        } else {
            $swal.fire({
                title: `There was an error creating the project ${projectName}.`,
                confirmButtonColor: "#3C8DBC",
            });
        }
    }
}
async function getProjects() {
    state.projects = [];
    const token = getAuthToken();
    const url = `${baseUrl()}/project/list`;
    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization_Type": "auth",
        },
    });
    const data = await response.json();
    state.projects = data.map((project) => {
        return {
            id: project.id,
            user_id: project.user_platform_id,
            name: project.name,
            dataSources: 0,
            sheets: 0,
            visualizations: 0,
            dashboards: 0,
            stories: 0,
        }
    });
}
async function deleteProject(projectId) {
    const token = getAuthToken();
    const requestOptions = {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "Authorization_Type": "auth",
        },
    };
    const response = await fetch(`${baseUrl()}/project/delete/${projectId}`, requestOptions);
    if (response && response.status === 200) {
        const data = await response.json();
        $swal.fire(`The project has been deleted successfully.`);
    } else {
        $swal.fire(`There was an error deleting the project.`);
    }
    getProjects();
}
onMounted(async () => {
    await getProjects();
})
</script>
<template>
    <div class="min-h-100 flex flex-col m-10 mt-5 border border-primary-blue-100 border-solid p-10 shadow-md">
        <div class="font-bold text-2xl mb-5">
            Projects
        </div>
        <div class="text-md">
            All of your data and files will be contained within projects. All projects are isolated from one another and help with organization of your analysis.
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-10 lg:grid-cols-4 xl:grid-cols-5">
            <notched-card class="justify-self-center mt-10">
                <template #body="{ onClick }">
                    <div class="flex flex-col justify-center text-xl font-bold cursor-pointer items-center" @click="addProject">
                        <div class="bg-gray-300 border border-gray-300 border-solid rounded-full w-20 h-20 flex items-center justify-center mb-5">
                            <font-awesome icon="fas fa-plus" class="text-4xl text-gray-500" />
                        </div>
                        Add Project
                    </div>
                </template>
            </notched-card>
            <notched-card v-for="project in state.projects" class="justify-self-center mt-10">
                <template #body="{ onClick }">
                    <NuxtLink :to="`/projects/${project.name}/data-sources`">
                        <div class="flex flex-col justify-center cursor-pointer">
                            <div class="text-md font-bold">
                                {{project.name}}
                            </div>
                            <div class="bg-gray-300 p-5">
                                Screenshot here
                            </div>
                            <div class="flex flex-row justify-between mt-1">
                                <ul class="text-xs">
                                    <li>{{ project.dataSources }} Data Sources</li>
                                    <li>{{ project.sheets }} Sheets</li>
                                    <li>{{ project.visualizations }} Visualizations</li>
                                    <li>{{ project.dashboards }} Dashboard</li>
                                    <li>{{ project.stories }} Story</li>
                                </ul>
                                <div>
                                    <font-awesome icon="fas fa-trash" class="text-xl text-red-500 hover:text-red-400" @click="deleteProject(project.id)" />
                                </div>
                            </div>
                        </div>
                    </NuxtLink>
                </template>
            </notched-card>
        </div>
    </div>
</template>