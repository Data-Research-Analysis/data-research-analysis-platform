<script setup>
const route = useRoute();
const router = useRouter();
const state = reactive({
    menu_items: [],
})
const props = defineProps({
});
function toggleMenuItem(menuItem) {
    menuItem.show_menu = !menuItem.show_menu;
}
</script>
<template>
    <div class="flex flex-col min-h-150 bg-gray-300 shadow-md">
        <div
            class="flex flex-col mt-5 ml-5 mr-2 transition-all duration-500 opacity-100 h-auto"
        >
            <div
                v-for="menu in state.menu_items"
                :key="menu.id"
                class="text-mdw-full h-10 flex items-center justify-start mb-2 opacity-100 h-auto"
            >
                <div class="flex flex-col ml-4 select-none cursor-pointer ">
                    <div class="flex flex-row" @click="toggleMenuItem(menu)">
                        <font-awesome v-if="!menu.show_menu" icon="fas fa-angle-right" class="mt-1 mr-1" />
                        <font-awesome v-else="menu.show_menu" icon="fas fa-angle-down" class="mt-1 mr-1" />
                        <h5 class="w-full"
                            v-tippy="{ content: `${menu.menu_name}`, placement: 'right' }"
                        >
                            {{ menu.menu_name.length > 20 ? `${menu.menu_name.substring(0, 20)}...`: menu.menu_name }}
                        </h5>
                    </div>
                    <div>
                        <div class="flex flex-col">
                            <div v-for="subMenu in menu.sub_menus" class="ml-2">
                                <h6 v-tippy="{content:`${subMenu.name}`}" class="text-left text-sm font-bold hover:text-gray-500 p-1 m-1">
                                    {{ subMenu.name > 20 ? `${subMenu.name.substring(0, 20)}...`: subMenu.name }}
                                </h6>
                            </div>
                        </div>                        
                    </div>
                </div>
            </div>
        </div>        
    </div>
</template>