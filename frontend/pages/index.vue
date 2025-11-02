<script setup>
import { onMounted } from "vue";

// SEO Meta Tags for Homepage
useHead({
    title: 'Data Research Analysis - Open Source Data Analysis Platform',
    meta: [
        { name: 'description', content: 'Free open source data analysis platform for connecting, analyzing, and visualizing data from multiple sources. Build custom dashboards with Excel, PDF, PostgreSQL, MySQL, and MariaDB integration.' },
        { name: 'keywords', content: 'data analysis, open source, data visualization, business intelligence, dashboard, PostgreSQL, MySQL, MariaDB, Excel analysis, PDF data extraction' },
        { name: 'author', content: 'Data Research Analysis' },
        { name: 'robots', content: 'index, follow' },
        
        // Open Graph / Facebook
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://dataresearchanalysis.com/' },
        { property: 'og:title', content: 'Data Research Analysis - Open Source Data Analysis Platform' },
        { property: 'og:description', content: 'Free open source data analysis platform for connecting, analyzing, and visualizing data from multiple sources. Build custom dashboards with ease.' },
        { property: 'og:image', content: 'https://dataresearchanalysis.com/images/og-image.png' },
        
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:url', content: 'https://dataresearchanalysis.com/' },
        { name: 'twitter:title', content: 'Data Research Analysis - Open Source Data Analysis Platform' },
        { name: 'twitter:description', content: 'Free open source data analysis platform for connecting, analyzing, and visualizing data from multiple sources.' },
        { name: 'twitter:image', content: 'https://dataresearchanalysis.com/images/og-image.png' },
    ],
    link: [
        { rel: 'canonical', href: 'https://dataresearchanalysis.com/' }
    ]
});

onMounted(() => {

})
</script>
<template>
    <div>
        <hero />
        <problems id="about" />
        <why-dra id="why-dra" />
        <how-do-it-get-started id="how-do-it-get-started" />
        <we-understand id="we-understand" />
        <add-external-data-source id="add-external-data-source" />
        <build-data-model id="build-data-model" />
        <community id="community" />
        <join-private-beta id="join-private-beta" />
    </div>
</template>